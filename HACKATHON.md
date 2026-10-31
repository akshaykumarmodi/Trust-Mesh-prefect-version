HACKATHON.md

PROJECT NAME: TRUSTMESH
TAGLINE: Building a Trust Network Across the Open-Source Ecosystem

1. TEAM INFORMATION

Team Name: Nexora

Team Members:
 Kartik Goyal
 Akshay Kumar Modi
 Avi Garg

Selected Problem Statement:
Problem 07 – A Trust Network Against AI Slop


2. THE PROBLEM

Open-source development depends on trust.

Every day, maintainers review pull requests, evaluate contributors, and decide which contributions deserve acceptance. However, the increasing volume of AI-generated low-quality contributions, suspicious accounts, and coordinated spam campaigns is making this process harder.

A contributor may behave suspiciously across multiple repositories, while each individual project sees only a small part of the activity.

This creates a major challenge:

How can independent open-source projects share trust-related information and identify coordinated abuse without depending on a central authority?

TrustMesh aims to address this problem.


3. OUR SOLUTION

TrustMesh is a decentralized trust network that enables independent open-source projects to exchange contributor-related trust signals, evaluate evidence, and identify suspicious cross-project activity.

Instead of treating every project as an isolated environment, TrustMesh connects projects through a shared network of trust records.

The goal is not to automatically label contributors as good or bad.

The goal is to help maintainers make better-informed decisions using transparent evidence, project-specific trust policies, and cross-project signals.


4. KEY FEATURES

1. Contributor Trust Profiles
A unified view of contributor-related trust signals, vouches, denouncements, and supporting evidence.

2. Project-Level Trust Management
Each project can define which external projects it trusts and how much weight it gives their trust signals.

3. Vouch and Denouncement System
Projects can share positive endorsements and report suspicious activity with supporting evidence.

4. Cross-Project Trust Sharing
Trust-related records can be exchanged between independent projects while preserving their original source.

5. Trust Network Visualization
An interactive graph showing relationships between projects, contributors, and trust signals.

6. Coordinated Spam Detection
Identify potentially coordinated activity through similar contributions, unusual activity bursts, and repeated behavior across repositories.

7. Evidence-Based Trust Evaluation
Trust assessments are based on transparent rules and available evidence.

8. New Contributor Fairness
New contributors are not automatically treated as suspicious simply because they have no previous reputation.


5. WHAT MAKES TRUSTMESH DIFFERENT?

Most moderation systems focus on activity inside a single repository.

TrustMesh focuses on relationships and trust signals shared across multiple independent projects.

Our approach emphasizes:

- Decentralization
- Selective Trust
- Evidence Before Judgment
- Transparency
- Fairness
- Human Oversight


6. TECHNOLOGY STACK

Frontend: React.js and Vite
Styling: Tailwind CSS
Backend: Python and FastAPI
Database: SQLite
Network Visualization: React Flow
Open-Weight AI Model: GPT-OSS-120B
Planned Model Access: OpenRouter, subject to hackathon approval


7. TECHNICAL ARCHITECTURE

The planned architecture separates the user interface, backend decision-making, data storage, and AI-assisted analysis.

USER
  |
  v
REACT + VITE
  |
  v
FASTAPI BACKEND
  |
  +------ TRUST ENGINE
  |
  +------ CAMPAIGN DETECTION
  |
  +------ EVIDENCE ANALYSIS
  |
  v
SQLITE DATABASE
  |
  v
TRUST NETWORK
  |
  v
REACT FLOW GRAPH

The AI-assisted analysis component will provide explanations and summaries of evidence.

The backend's deterministic rules will remain responsible for trust evaluation.


8. AI MODEL USAGE

Model: GPT-OSS-120B

GPT-OSS-120B is an open-weight language model released under the Apache 2.0 license.

We plan to use this model for:

- Summarizing suspicious pull request patterns.
- Analyzing supplied contributor activity evidence.
- Explaining potential coordination signals.
- Helping maintainers understand complex evidence.

RESPONSIBLE AI DESIGN

AI will assist with analysis, not make final moderation decisions.

Trust scores and project-level trust decisions will be calculated using transparent backend rules.

The system will preserve the difference between an allegation, a supporting signal, and verified evidence.

Model integration and actual usage will be tested before being claimed as completed functionality.

Hosting Note:
OpenRouter is currently a planned access method and will be used only if its hosting arrangement is approved under the hackathon's model requirements.


9. FAIRNESS AND SAFETY PRINCIPLES

1. New contributors begin with an unknown or neutral reputation state.
2. A denouncement is treated as an allegation, not automatic proof.
3. Evidence and its original source are preserved.
4. Projects retain control over which external trust sources they accept.
5. Conflicting trust signals should remain visible.
6. Suspicious-pattern alerts should support human investigation rather than automatically establish guilt.


10. PLANNED DEMONSTRATION SCENARIOS

- A trusted contributor receiving a vouch from a project.
- A project receiving a denouncement with supporting evidence.
- Similar suspicious activity appearing across multiple repositories.
- A newcomer participating without an established reputation.
- Two projects disagreeing about the same contributor.


11. AI DEVELOPMENT TOOLS

AI Coding Assistants:
- ChatGPT
- Antigravity

The actual AI models and coding assistants used will be disclosed accurately in the relevant pull requests.


12. PROJECT DEVELOPMENT STATUS

Status: Under Development

TrustMesh is being developed as a hackathon prototype.

Our focus is to demonstrate a working foundation for cross-project trust sharing, evidence-based contributor evaluation, and coordinated activity detection.

We aim to prioritize functional features, understandable decisions, and a clear demonstration over superficial complexity.


13. OUR VISION

Open-source software is built by communities that depend on collaboration and trust.

As AI changes how software is created, maintaining that trust becomes even more important.

TrustMesh envisions an ecosystem where projects can learn from one another, share useful trust signals, detect coordinated abuse, and still give every new contributor a fair opportunity.

Trust should be shared.
Evidence should be transparent.
Decisions should remain fair.


BUILT BY TEAM NEXORA
HACKATHON 2026 (Hacktoberfest)