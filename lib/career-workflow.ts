export const CAREER_SOURCE_TYPE_OPTIONS = [
  {
    value: "cv",
    label: "CV",
    priority: "Start here",
    guidance: "Upload the latest CV or resume. This gives the workspace the factual baseline of roles, achievements, and career history.",
    suggestedTitle: "Current CV",
  },
  {
    value: "gallup_strengths",
    label: "Gallup Strengths report",
    priority: "Essential",
    guidance: "Upload the Gallup Strengths report if available. This is the strongest input for tone, strengths language, and higher-quality positioning.",
    suggestedTitle: "Gallup Strengths Report",
  },
  {
    value: "linkedin",
    label: "LinkedIn profile",
    priority: "Recommended",
    guidance: "Paste or upload the candidate's LinkedIn About, headline, and profile text so the workspace can mirror public-facing language.",
    suggestedTitle: "LinkedIn Profile Text",
  },
  {
    value: "cover_letter",
    label: "Old cover letter",
    priority: "Recommended",
    guidance: "Upload past letters to show voice, structure, and evidence the candidate already uses.",
    suggestedTitle: "Previous Cover Letter",
  },
  {
    value: "achievements",
    label: "Achievements",
    priority: "Helpful",
    guidance: "Use this for quantified wins, case studies, awards, promotions, and evidence the system can reuse in tailored assets.",
    suggestedTitle: "Key Achievements",
  },
  {
    value: "recruiter_feedback",
    label: "Recruiter feedback",
    priority: "Helpful",
    guidance: "Add recruiter notes, objections, or market feedback so the workspace can adapt positioning and interview prep more intelligently.",
    suggestedTitle: "Recruiter Feedback",
  },
  {
    value: "job-target",
    label: "Target role brief",
    priority: "Helpful",
    guidance: "Use this for target-role descriptions, preferred industries, or search direction so the workspace knows where to aim.",
    suggestedTitle: "Target Role Brief",
  },
  {
    value: "notes",
    label: "Notes",
    priority: "Flexible",
    guidance: "Add any extra context that does not fit elsewhere, such as motivation, constraints, or personal working preferences.",
    suggestedTitle: "Career Notes",
  },
  {
    value: "background",
    label: "Background",
    priority: "Flexible",
    guidance: "Use this for background context such as career change stories, industry history, or personal context that matters.",
    suggestedTitle: "Career Background",
  },
  {
    value: "strengths",
    label: "Strengths",
    priority: "Flexible",
    guidance: "Use this for non-Gallup strengths material, personality summaries, or self-written strengths notes.",
    suggestedTitle: "Strengths Notes",
  },
  {
    value: "interview_notes",
    label: "Interview notes",
    priority: "Later stage",
    guidance: "Upload interview prep notes, panel context, or observed interview themes for upcoming conversations.",
    suggestedTitle: "Interview Notes",
  },
  {
    value: "interview_reflection",
    label: "Interview reflection",
    priority: "Later stage",
    guidance: "Use this after a real interview to capture what happened, what landed well, and what should improve next time.",
    suggestedTitle: "Interview Reflection",
  },
] as const

export type CareerSourceTypeValue = (typeof CAREER_SOURCE_TYPE_OPTIONS)[number]["value"]

export const CAREER_SOURCE_WIZARD_STEPS: CareerSourceTypeValue[] = [
  "cv",
  "gallup_strengths",
  "linkedin",
  "cover_letter",
  "achievements",
  "recruiter_feedback",
  "job-target",
]

export const CAREER_SOURCE_PREP_STEPS = [
  {
    id: "cv",
    title: "Load the CV",
    description: "Paste the current CV so the workspace has a solid experience baseline.",
    actionLabel: "Open source material",
  },
  {
    id: "strengths",
    title: "Add Gallup Strengths",
    description: "This is the engine-room document for stronger positioning and more personal language.",
    actionLabel: "Add strengths report",
  },
  {
    id: "proof",
    title: "Add LinkedIn and other proof",
    description: "Bring in LinkedIn text, old cover letters, achievements, recruiter notes, and job targets.",
    actionLabel: "Load supporting proof",
  },
] as const

