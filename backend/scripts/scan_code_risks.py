"""Run local scanners and export a report for authenticated ProjectOps import."""
import argparse
import os
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.code_risk.runner import scan_repository
from app.schemas.code_risk import MAX_REPORT_BYTES


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repository', type=Path)
    parser.add_argument('--target-id', type=int, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.target_id < 1:
        parser.error('Target ID must be positive.')
    try:
        report = scan_repository(args.repository, args.target_id)
        content = report.model_dump_json(indent=2).encode()
        if len(content) > MAX_REPORT_BYTES:
            raise ValueError('Report exceeded the import limit. Select a smaller source scope.')
        destination = args.output.resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as temp:
            temp.write(content)
            temporary = Path(temp.name)
        try:
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
        print(f'Report saved: {destination}. Findings: {len(report.findings)}. Review coverage before interpreting results.')
        return 0 if all(t.outcome == 'completed' for t in report.tools) else 2
    except (ValueError, OSError) as error:
        print(f'Scan could not complete: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
