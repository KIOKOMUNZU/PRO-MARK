# ZELIMU CBC Merit strictness patch

- Keeps existing ZELIMU merit PDF layout and class/overall positions.
- Individual examination is selected by assessment ID (not assessment type), allowing multiple CATs of the same type.
- Weighted term results apply configured positive examination weights, requiring their total to equal 100%.
- Per-subject weighted score is calculated before learner average; denominator is expected subjects, never number of exams.
- Expected subjects come from active class subject assignments plus subjects seen in marks for the selected class and term.
- Missing expected subjects or compulsory exams, missing class subject configuration, and invalid weights mark learners INCOMPLETE, with no official rank.
- Only complete learners contribute to class, grade, and subject rankings.
- Existing PDF layout is retained, with incomplete marks displayed as dashes and incomplete grade as INC.

## Known limitations before production
- Requires teacher_subject_assignments to be populated accurately for every class; otherwise results are intentionally INCOMPLETE.
- Learners with no mark rows at all are not yet enumerated in the merit output. Full enrollment-roster coverage is a further required step.
- Assessment approval/publication checks, exempted subjects, detailed analytics dashboards and whole-grade PDF selection still need integration and database-backed tests.
- No live Supabase integration tests were possible in this environment. Do not publish official merits before validating against real school data.
