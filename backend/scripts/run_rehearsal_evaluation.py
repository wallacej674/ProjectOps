"""Execute the approved synthetic evaluation once, with a durable spend journal.

Run from backend. The application loads its existing provider configuration.
The journal is never automatically resumed, retried, or overwritten.
"""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.rehearsal_provider import response_body
from app.schemas.rehearsal_workflows import ReviewOutput

MODEL = 'gpt-5.4-mini-2026-03-17'
RESERVATION = Decimal('0.031932')
CAP = Decimal('1.00')


def stamp():
    return datetime.now(timezone.utc).isoformat()


def save(path, value):
    temporary = path.with_suffix(path.suffix + '.pending')
    with temporary.open('w', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def run(preview, journal, provider):
    journal = Path(journal)
    digest = hashlib.sha256(json.dumps(preview, sort_keys=True).encode()).hexdigest()
    if journal.exists():
        existing = json.loads(journal.read_text(encoding='utf-8'))
        if existing['preview_digest'] != digest:
            raise ValueError('Existing journal belongs to a different preview.')
        return existing
    requests = preview['requests']
    if preview['model'] != MODEL or not 1 <= len(requests) <= 20 or len({r['case_id'] for r in requests}) != len(requests):
        raise ValueError('Preview is outside the approved model or case limits.')
    packets = []
    for request in requests:
        body = request['body']
        packet = json.loads(body['input'][0]['content'])
        if response_body(packet, MODEL) != body or len(json.dumps(body, ensure_ascii=True).encode()) > 24576:
            raise ValueError('Preview differs from current bounded application request. Review a new preview.')
        if 'expected' in packet or 'next_action' in packet:
            raise ValueError('Grading labels must not enter model input.')
        packets.append(packet)
    prior = Decimal(str(preview.get('prior_spend_upper_bound_usd', 0)))
    if not 0 <= prior <= CAP:
        raise ValueError('Invalid prior spend.')
    report = {'preview_digest': digest, 'model': MODEL, 'started_at': stamp(), 'spend_cap_usd': 1,
              'reserved_usd': float(prior), 'prior_spend_upper_bound_usd': float(prior), 'attempts': [], 'status': 'running', 'live_provider_evaluated': False}
    # Exclusive creation prevents two invocations from dispatching the same run.
    with journal.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    reserved = prior
    for request, packet in zip(requests, packets):
        if reserved + RESERVATION > CAP:
            report['status'] = 'budget_exhausted'
            break
        reserved += RESERVATION
        attempt = {'case_id': request['case_id'], 'status': 'dispatching', 'started_at': stamp(),
                   'reserved_usd': float(RESERVATION)}
        report['attempts'].append(attempt)
        report['reserved_usd'] = float(reserved)
        save(journal, report)
        try:
            result = provider(packet, MODEL)
            output = ReviewOutput.model_validate(result['output']).model_dump()
            usage = result.get('usage') or {}
            attempt.update(status='completed', output=output,
                usage={key: value for key, value in usage.items()
                       if key in ('input_tokens', 'output_tokens', 'total_tokens') and type(value) is int and value >= 0})
        except Exception as error:
            # No exception text or HTTP headers are persisted or printed.
            attempt.update(status='unknown_outcome', error_type=type(error).__name__)
            report['status'] = 'stopped_uncertain'
        attempt['finished_at'] = stamp()
        save(journal, report)
        if report['status'] == 'stopped_uncertain':
            break
    else:
        report['status'] = 'completed'
    report['finished_at'] = stamp()
    save(journal, report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('preview')
    parser.add_argument('journal')
    parser.add_argument('--execute-approved', action='store_true')
    args = parser.parse_args()
    if not args.execute_approved:
        parser.exit(2, 'Execution requires the approved input preview and spending cap.\n')
    from app.services.rehearsal_provider import generate, provider_available
    if not provider_available():
        parser.exit(2, 'OpenAI runtime access is not configured. No calls made.\n')
    try:
        preview_bytes = Path(args.preview).read_bytes()
        if hashlib.sha256(preview_bytes).hexdigest() != '6dc2cd8734f1b1e380baf8f86dfa614ff1a0fac01aa4ffa2c2941bfb99a9f474':
            raise ValueError('Preview differs from the approved exact input.')
        report = run(json.loads(preview_bytes), Path(args.journal), generate)
        # Provenance applies only to this CLI's actual configured provider, never fake tests.
        report['live_provider_evaluated'] = any(a['status'] == 'completed' for a in report['attempts'])
        save(Path(args.journal), report)
    except (ValueError, KeyError, OSError) as error:
        parser.exit(2, f'Evaluation stopped: {type(error).__name__}. No automatic retry.\n')
    print(json.dumps({'status': report['status'], 'attempts': len(report['attempts']),
                      'reserved_usd': report['reserved_usd']}))
    return 0 if report['status'] == 'completed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
