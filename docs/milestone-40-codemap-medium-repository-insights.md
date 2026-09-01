# Milestone 40: CodeMap Medium Repository Insights

## Goal

Make repository analysis more useful by deriving deterministic, evidence-backed
insights from selected public manifests and configuration files while retaining
the existing path-based CodeMap signals.

## Behavior

Each new Repo Analysis snapshot records an analysis version, structured
insights, evidence-file mappings, and the files inspected. The analyzer can
identify declared runtimes, frameworks, package managers, project commands,
dependency counts, CI configuration, and container configuration.

Inspection is restricted to a fixed allowlist that includes package manifests,
lockfiles, container configuration, root README metadata, `.env.example`, and
GitHub Actions workflow files. Fetching is limited to 20 files, 128 KiB per
file, and 512 KiB in total. Unsupported source files are never fetched.

## Security and Product Boundaries

- Public GitHub repositories only.
- No repository cloning or archive extraction.
- No script execution or dependency installation.
- No arbitrary source-code inspection.
- No private-repository token support.
- No AI or AST analysis.
- No vulnerability, license, or production-safety certification.
- Manifest declarations are observations, not verification that tooling works.

## Compatibility

Existing CodeMap Lite snapshots remain readable. They default to
`codemap_lite_v1` with empty insight fields. New snapshots use
`codemap_medium_v1`.

## Known Limitations

GitHub unauthenticated API limits still apply. YAML workflows are treated as
operational evidence without general-purpose YAML deserialization. Large or
invalid supported files can be skipped and reported as warnings.
