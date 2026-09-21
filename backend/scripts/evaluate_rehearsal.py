"""Evaluate saved rehearsal responses offline. This command never invokes a model.

Usage: python scripts/evaluate_rehearsal.py cases.json responses.json
Exit 1 means an evaluated case failed; 2 means invalid input. Human assessment of
test adequacy and recommendation usefulness remains a separate recorded review.
"""
import argparse
import json
from pathlib import Path


def read_json(path):
    data = Path(path).read_bytes()
    if len(data) > 2 * 1024 * 1024:
        raise ValueError('Evaluation input exceeds 2 MiB.')
    return json.loads(data)


def evaluate(cases, responses):
    if not isinstance(cases, list) or not cases or len(cases) > 500 or not isinstance(responses, dict):
        raise ValueError('Expected 1-500 cases and a response object keyed by case ID.')
    records, unsupported_count, seen = [], 0, set()
    for case in cases:
        case_id = case['id']
        if case_id in seen:
            raise ValueError('Duplicate evaluation case ID.')
        seen.add(case_id)
        expected = case['expected']
        required = {str(row['id']) for row in case['requirements']}
        allowed = {'not_verified', 'supported', 'gap_found', 'conflicting'}
        if not required or not isinstance(expected, dict) or set(expected) != required:
            raise ValueError('Each requirement needs an expected outcome label.')
        if any(not isinstance(values, list) or not values or not set(values).issubset(allowed)
               for values in expected.values()):
            raise ValueError('Expected outcomes must use assessment states.')
        evidence_ids = {row['id'] for row in case['evidence']}
        response = responses.get(case_id)
        errors = []
        assessed = set()
        if not isinstance(response, dict):
            errors.append('Missing saved response.')
            assessments = []
        else:
            assessments = response.get('assessments', [])
            if not isinstance(assessments, list):
                errors.append('Assessments must be a list.')
                assessments = []
        for assessment in assessments:
            key = str(assessment['requirement_id'])
            outcome = assessment['outcome']
            citations = assessment.get('evidence_ids', [])
            if key in assessed:
                errors.append(f'Duplicate requirement {key}.')
            assessed.add(key)
            if key not in expected:
                errors.append(f'Unknown requirement {key}.')
            elif outcome not in expected[key]:
                errors.append(f'Unexpected outcome for requirement {key}: {outcome}.')
            invalid = not isinstance(citations, list) or any(c not in evidence_ids for c in citations)
            if invalid:
                errors.append(f'Unknown evidence citation for requirement {key}.')
            if outcome == 'supported' and (not citations or invalid or outcome not in expected.get(key, [])):
                unsupported_count += 1
                errors.append(f'Unsupported support for requirement {key}.')
        for key in expected:
            if key not in assessed:
                errors.append(f'Missing assessment for requirement {key}.')
        records.append({'id': case_id, 'passed': not errors, 'errors': errors,
                        'human_review_prompt': case.get('next_action', '')})
    return {'cases': records, 'passed': sum(row['passed'] for row in records),
            'total': len(records), 'unsupported_support_count': unsupported_count,
            'human_actionability': 'not_rated', 'live_provider_evaluated': False,
            'limitations': ['Offline checks compare saved responses with labeled expected outcomes and citation IDs.',
                            'Response origin and test execution are not independently verified.',
                            'Human review of recommendation usefulness and evidence adequacy is still required.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cases')
    parser.add_argument('responses')
    args = parser.parse_args()
    try:
        report = evaluate(read_json(args.cases), read_json(args.responses))
    except (ValueError, TypeError, KeyError, OSError) as error:
        parser.exit(2, f'Invalid evaluation inputs: {type(error).__name__}.\n')
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] == report['total'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
