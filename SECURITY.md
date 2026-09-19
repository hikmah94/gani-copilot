# Security and responsible disclosure

GANI processes public civic records and anonymous community observations. Please do not open a public issue for a vulnerability that could expose administrator access, reporter metadata, stored files, or infrastructure credentials.

Report security concerns privately to the repository owner through GitHub’s private vulnerability reporting feature once enabled. Include the affected route, reproduction steps, likely impact, and any safe remediation suggestion. Do not access, modify, or download data beyond what is necessary to demonstrate the issue.

## Current proof-of-concept controls

- Signed, HTTP-only, secure administrator sessions.
- Role separation between administrators and super administrators.
- Prepared D1 statements and bounded tool parameters.
- Rate limits on public feedback and AI routes.
- File-size validation and controlled R2 access.
- Moderation before community observations are publicly visible.
- Document-scoped Vectorize filtering plus D1 ownership validation.

## Known gaps

The public proof of concept is not a hardened production service. Turnstile is configurable but not enabled in the current deployment; WAF policy, automated abuse detection, backup/retention policy, incident response, dependency scanning, and external penetration testing remain future work. Do not use this deployment for confidential reports or emergency assistance.
