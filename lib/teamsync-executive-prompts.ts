export type TeamSyncExecutivePrompt = {
  id: string
  tier: "Premium" | "Boardroom"
  pack: string
  category: string
  title: string
  promptText: string
}

export const teamsyncExecutivePromptLibrary: TeamSyncExecutivePrompt[] = [
  {
    id: "TS-EX-001",
    tier: "Premium",
    pack: "Build the Right Executive Team",
    category: "Executive Team Design",
    title: "Leadership structure for new division",
    promptText:
      "Based on the loaded Gallup Strengths of our executive team, recommend the best leadership structure for the new division we are proposing. Define roles, reporting lines, decision rights, and success conditions.",
  },
  {
    id: "TS-EX-002",
    tier: "Premium",
    pack: "Build the Right Executive Team",
    category: "Executive Team Design",
    title: "Role-fit for new division",
    promptText:
      "Using the loaded strengths, identify which executives are best suited to lead strategy, operations, people, growth, innovation, and risk in the new business unit. Explain fit and support needs.",
  },
  {
    id: "TS-EX-004",
    tier: "Premium",
    pack: "Build the Right Executive Team",
    category: "Executive Team Design",
    title: "Overlap and gaps",
    promptText:
      "Where do we have too much overlap in executive strengths, and where do we have critical gaps that may weaken the division or create bottlenecks?",
  },
  {
    id: "TS-EX-007",
    tier: "Premium",
    pack: "Build the Right Executive Team",
    category: "Executive Team Design",
    title: "Decision rights design",
    promptText:
      "How should we structure decision rights across this executive team so strengths are used well without creating bottlenecks, ambiguity, or political tension?",
  },
  {
    id: "TS-EX-011",
    tier: "Premium",
    pack: "Strategy and Execution",
    category: "Strategy and Execution",
    title: "How the team builds strategy",
    promptText:
      "How is this executive team likely to behave during strategy development based on combined Gallup strengths? Identify patterns in ideation, challenge, alignment, and decision-making.",
  },
  {
    id: "TS-EX-012",
    tier: "Premium",
    pack: "Strategy and Execution",
    category: "Strategy and Execution",
    title: "What we decide well and poorly",
    promptText:
      "What types of strategic decisions is this team likely to make well, and which may be distorted by strengths biases, blind spots, or internal dynamics?",
  },
  {
    id: "TS-EX-016",
    tier: "Premium",
    pack: "Strategy and Execution",
    category: "Strategy and Execution",
    title: "Move from discussion to execution",
    promptText:
      "What is the best way for this executive team to move from strategy discussion to execution discipline, given our strengths mix and likely operating habits?",
  },
  {
    id: "TS-EX-018",
    tier: "Premium",
    pack: "Strategy and Execution",
    category: "Strategy and Execution",
    title: "Assign strategic priorities",
    promptText:
      "How should strategic priorities be assigned across this executive team so ownership is clear, strengths are leveraged, and cross-functional execution accelerates?",
  },
  {
    id: "TS-EX-021",
    tier: "Premium",
    pack: "Crisis and Pressure Lab",
    category: "Crisis and Pressure",
    title: "Response in a major crisis",
    promptText:
      "How is this executive team likely to respond in a major crisis based on current strengths? Identify stabilizers, accelerators, and likely decision risks.",
  },
  {
    id: "TS-EX-024",
    tier: "Premium",
    pack: "Crisis and Pressure Lab",
    category: "Crisis and Pressure",
    title: "Unhelpful crisis behaviors",
    promptText:
      "Under severe pressure, what unhelpful behaviors could emerge from this strengths mix, and how should we pre-empt them in our crisis operating protocol?",
  },
  {
    id: "TS-EX-028",
    tier: "Premium",
    pack: "Crisis and Pressure Lab",
    category: "Crisis and Pressure",
    title: "Decision framework for crisis",
    promptText:
      "Design a crisis decision framework tailored to this executive team’s strengths so we can move fast while preserving governance quality.",
  },
  {
    id: "TS-EX-030",
    tier: "Premium",
    pack: "Crisis and Pressure Lab",
    category: "Crisis and Pressure",
    title: "Fault lines in prolonged crisis",
    promptText:
      "If the crisis lasts 90 days, where are the likely executive fault lines, burnout points, and handoff breakdowns across this strengths profile?",
  },
  {
    id: "TS-EX-041",
    tier: "Premium",
    pack: "Transformation and Change",
    category: "Change and Transformation",
    title: "Transformation readiness",
    promptText:
      "Assess transformation readiness of this executive team using loaded strengths. Show where we are naturally ready and where capability scaffolding is needed.",
  },
  {
    id: "TS-EX-045",
    tier: "Premium",
    pack: "Transformation and Change",
    category: "Change and Transformation",
    title: "Communicate operating model change",
    promptText:
      "How should this team communicate a major operating model change so messages remain clear, credible, and aligned with each executive’s strengths?",
  },
  {
    id: "TS-EX-048",
    tier: "Premium",
    pack: "Transformation and Change",
    category: "Change and Transformation",
    title: "Change fatigue risk",
    promptText:
      "Identify change-fatigue risk across the executive team and propose role-specific interventions to maintain momentum and psychological safety.",
  },
  {
    id: "TS-EX-050",
    tier: "Premium",
    pack: "Transformation and Change",
    category: "Change and Transformation",
    title: "Capability to add or borrow",
    promptText:
      "What executive capabilities should we add, borrow, or temporarily embed to deliver this transformation effectively based on current strengths coverage?",
  },
  {
    id: "TS-EX-052",
    tier: "Premium",
    pack: "Executive Dynamics and Performance",
    category: "Team Dynamics and Effectiveness",
    title: "Sources of friction",
    promptText:
      "What are the most likely sources of friction across this executive team’s strengths profile, and what operating agreements would reduce drag?",
  },
  {
    id: "TS-EX-056",
    tier: "Premium",
    pack: "Executive Dynamics and Performance",
    category: "Team Dynamics and Effectiveness",
    title: "Trust breakdown risks",
    promptText:
      "Where is trust most at risk in this executive team, and what concrete cadence, language, and role boundaries should we set now?",
  },
  {
    id: "TS-EX-059",
    tier: "Premium",
    pack: "Executive Dynamics and Performance",
    category: "Team Dynamics and Effectiveness",
    title: "Who is underused or miscast",
    promptText:
      "Which executives appear underused or miscast relative to strengths, and how should we redesign responsibilities for stronger enterprise outcomes?",
  },
  {
    id: "TS-EX-060",
    tier: "Premium",
    pack: "Executive Dynamics and Performance",
    category: "Team Dynamics and Effectiveness",
    title: "Top three team upgrades",
    promptText:
      "What are the top three upgrades this executive team should make now to improve decision quality, execution speed, and team trust?",
  },
  {
    id: "TS-EX-062",
    tier: "Premium",
    pack: "CHRO Suite",
    category: "Talent and Succession",
    title: "Strategic capability gaps",
    promptText:
      "From an enterprise talent lens, what strategic capability gaps are most material in this executive strengths map for the next 12-24 months?",
  },
  {
    id: "TS-EX-064",
    tier: "Premium",
    pack: "CHRO Suite",
    category: "Talent and Succession",
    title: "Succession planning through strengths",
    promptText:
      "Build a strengths-based succession view for this executive team, including near-term coverage, bench depth, and development priorities.",
  },
  {
    id: "TS-EX-067",
    tier: "Premium",
    pack: "CHRO Suite",
    category: "Talent and Succession",
    title: "HR watchouts",
    promptText:
      "What HR watchouts should be actively monitored based on this executive strengths mix (attrition risk, overload, role ambiguity, conflict patterns)?",
  },
  {
    id: "TS-EX-070",
    tier: "Premium",
    pack: "CHRO Suite",
    category: "Talent and Succession",
    title: "Development plans without boxing people in",
    promptText:
      "Design executive development plans that leverage strengths while avoiding over-specialization, role boxing, or reduced enterprise adaptability.",
  },
  {
    id: "TS-BR-001",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Board challenge on strategic clarity",
    promptText:
      "The board challenges our strategic clarity and coherence. Based on loaded executive strengths, assess likely boardroom behavior, risk points, and how to align leadership responses.",
  },
  {
    id: "TS-BR-003",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Investor confidence under pressure",
    promptText:
      "Investor confidence is weakening after mixed performance. How should this executive team, given strengths profile, manage board communication and credibility recovery?",
  },
  {
    id: "TS-BR-005",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "CEO succession stress test",
    promptText:
      "Run a CEO succession stress test using current executive strengths. Identify immediate succession risk, interim operating model, and board-facing mitigation plan.",
  },
  {
    id: "TS-BR-007",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Capital allocation conflict",
    promptText:
      "Board requests tighter capital discipline while executives push growth bets. Analyze likely conflict dynamics and propose a strengths-aligned capital decision protocol.",
  },
  {
    id: "TS-BR-009",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Governance quality scrutiny",
    promptText:
      "Governance quality is under scrutiny. Based on executive strengths, identify where governance may be weak (challenge, oversight, follow-through, transparency) and how to fix fast.",
  },
  {
    id: "TS-BR-012",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Major risk event board response",
    promptText:
      "A material risk event has triggered board escalation. Simulate executive response quality based on strengths and propose clear role split for board engagement.",
  },
  {
    id: "TS-BR-015",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Board-exec trust fracture",
    promptText:
      "Board and executive trust is deteriorating. Analyze likely contribution from our strengths dynamics and provide an immediate 30-day trust rebuild play.",
  },
  {
    id: "TS-BR-018",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Activist pressure simulation",
    promptText:
      "Simulate activist investor pressure scenario and evaluate whether the executive team strengths profile supports coherent response, narrative control, and execution confidence.",
  },
  {
    id: "TS-BR-021",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Strategic reset board mandate",
    promptText:
      "Board mandates a strategic reset. Use strengths mapping to design executive roles, governance rhythm, and decision rights for a disciplined reset cycle.",
  },
  {
    id: "TS-BR-024",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Crisis credibility in board updates",
    promptText:
      "In an ongoing crisis, assess how this executive team should structure board updates to maximize confidence, signal control, and avoid mixed messages.",
  },
  {
    id: "TS-BR-025",
    tier: "Boardroom",
    pack: "Boardroom Scenarios",
    category: "Board, Governance, and Communication",
    title: "Boardroom rehearsal before critical meeting",
    promptText:
      "Run a boardroom rehearsal: map who should lead each section, where likely challenge points are, and how to pre-brief executives for a high-stakes board decision.",
  },
]

