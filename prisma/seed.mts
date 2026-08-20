/**
 * Seed data: one realistic project with genuinely messy discovery material.
 *
 * The sources are deliberately imperfect — contradictions, vague adjectives,
 * an unresolved open question, an actor mentioned only in passing. That is what
 * real intake looks like, and it is the only way to tell whether extraction and
 * the quality engine are actually earning their keep.
 *
 * Run with: npm run db:seed
 */

import { prisma } from "../lib/db/client";
import { contentChecksum } from "../lib/intake/checksum";

const WORKSHOP_NOTES = `Claims intake redesign — discovery workshop, 12 March
Attendees: Marieke de Vries (Head of Claims), Tom Bakker (Claims team lead), Priya Nair (IT architecture), Sander Willems (Compliance)

Current state
- Claims come in by email, phone and post. Team of 9 handlers rekeys everything into Guidewire by hand.
- Average 240 new claims a week. Peak after storms — last February they hit 700 in one week and it took 11 days to clear the backlog.
- Marieke: "the handlers spend more time typing than judging". Estimated 60% of handler time is data entry.
- No acknowledgement to the customer until a handler picks the claim up. Sometimes 4 days.

Pain points raised
- Customers phone to ask "did you get my claim" — Tom estimates 30-40% of inbound calls are just status chasing.
- Missing information is the biggest delay driver. Handler emails the customer, waits 2 days, gets a partial answer, emails again.
- Photos arrive as email attachments and get lost. Sander flagged this is also a retention problem — attachments outside the system are not covered by the retention policy.

What good looks like
- Marieke wants first response within 1 hour, automated.
- Tom wants the claim to arrive complete or not at all. "If they can't give us the policy number and the date of loss, don't let them submit."
- Priya: any portal has to write into Guidewire through the existing integration layer, no direct DB writes. She was clear this is non-negotiable.
- Should be easy to use for older customers — a lot of our book is over 60.

Open question: do we handle commercial claims in phase one or only private? Marieke thinks private only. Tom disagreed, said the commercial volume is small but the handlers are the same people. Not resolved.

Sander's constraints
- GDPR. Claims data retained 7 years from claim closure, then deleted.
- Anything that stores health data (injury claims) needs a DPIA before go-live.
- Customers must be able to request their claim file.`;

const TRANSCRIPT = `Call transcript — Tom Bakker (Claims team lead), 19 March, 40 min

Interviewer: Walk me through what happens when a claim comes in today.

Tom: Right, so it lands in the shared claims mailbox. One of the team picks it up, opens it, reads it. First thing they do is find the policy — that's searching Guidewire on name or postcode usually, because half the time the customer doesn't give us the policy number. If they can't find it, it goes in a holding folder and someone chases it.

Interviewer: How often does that happen?

Tom: More than you'd think. A quarter maybe? People genuinely don't know their policy number.

Interviewer: And once the policy is found?

Tom: Then they key in the claim. Date of loss, type of loss, description, estimated value if the customer gave one. Then they set the reserve — that's a judgement call, that bit's actually the job. Then it's assigned to whoever's handling that category.

Interviewer: You mentioned assignment. Is that automatic?

Tom: No, it's me. I look at the queue in the morning and split it. Motor to the motor people, property to property, and anything over fifty thousand goes to a senior. Anything with injury goes to a senior too, always, no exceptions — that's a firm rule, we've had that since before I started.

Interviewer: What would you want a new system to do differently?

Tom: Honestly? Stop the incomplete ones getting in. If someone submits without a date of loss we're immediately in email ping-pong. And I want the customer to get a claim reference straight away, so when they ring up we can find it in two seconds.

Interviewer: Anything you'd be worried about?

Tom: That it becomes rigid. There are always weird ones. Someone's had a fire and they're calling from a hotel and they don't have their policy documents — I still need to be able to open a claim for that person manually. Don't take that away from us.

Interviewer: What about the storm peaks?

Tom: That's when it really hurts. Everything I said, times three. The system needs to cope with a bad week without falling over.`;

const EMAIL = `From: Sander Willems (Compliance)
To: Claims redesign project
Subject: RE: Portal scope — compliance requirements
Date: 24 March

Following up on the workshop with the points I need reflected in the requirements.

1. Retention. Claim records including all attachments must be retained for 7 years from the date the claim is closed, then deleted. This applies to anything uploaded through the portal — that was the gap Marieke and I discussed, attachments currently sitting in mailboxes are effectively unmanaged.

2. Health data. If the portal accepts injury claims we are processing special category data under Article 9. That needs a DPIA completed and signed off before go-live, and injury claim data needs to be access-restricted to senior handlers only.

3. Subject access. A customer must be able to request a copy of their claim file. Today that is a manual export by IT that takes about a week. I would like the portal to make this self-service, but I accept that may be phase two.

4. Audit. Every change to a claim record needs to be attributable to a named user with a timestamp. This is a hard requirement from our last audit and it applies to portal submissions as well — "submitted by customer via portal" has to be recorded as an actor.

5. Identity. We must be reasonably confident the person submitting is the policyholder or an authorised representative. I'm not prescribing how, but "they know the policy number" is not sufficient on its own.

One thing I want to flag: the ambition to acknowledge within an hour is fine, but an automated acknowledgement must not say anything that could be read as accepting liability. Wording needs legal review.`;

const FEATURE_BRIEF = `Feature brief — Claims Portal (draft v0.3)

Goal
Let policyholders submit and track claims themselves, so handlers spend their time on assessment rather than data entry.

Phase one scope (proposed)
- Submit a new claim (private lines: motor, property)
- Upload supporting documents and photos
- Receive an immediate claim reference and acknowledgement
- Track claim status
- Respond to requests for further information

Out of scope for phase one
- Commercial claims
- Payment / settlement
- Live chat with a handler

Success measures
- 50% of private claims submitted through the portal within 6 months of launch
- Handler data entry time reduced by half
- Status-chasing calls reduced by 30%
- Acknowledgement sent within 1 hour of submission

Notes
- Must integrate with Guidewire via the existing integration layer.
- Needs to be fast and intuitive.
- Should work well on mobile — most photos will be taken on a phone at the scene.
- Accessibility: WCAG 2.2 AA. Our customer base skews older.`;

async function main() {
  const existing = await prisma.project.findFirst({
    where: { name: "Claims intake redesign" },
  });

  if (existing) {
    console.log(
      `Seed project already exists (${existing.id}). Delete it in the app first if you want a clean seed.`,
    );
    return;
  }

  const project = await prisma.project.create({
    data: {
      name: "Claims intake redesign",
      description:
        "Replacing manual claims intake with a self-service policyholder portal.",
      analysisGoal:
        "Define the target intake process and the functional scope for phase one, ready for a build estimate.",
      industry: "insurance",
      subdomain: "Claims processing, private lines",
      jurisdiction: "eu",
      // Article 9 special category data plus an audit obligation on
      // attribution — this is squarely in the high band.
      regulatorySensitivity: "high",
      solutionDomain: "Customer-facing web portal",
      domainContext:
        "Dutch non-life insurance, private lines (motor and property). Policy administration runs on Guidewire and must be written to through the existing integration layer only. Claims volume averages 240/week with storm peaks to 700.",
      defaultMode: "BA",
      status: "in_analysis",
      // Provenance is seeded deliberately mixed: notes taken in the room, a
      // transcript typed up afterwards, a mail thread, and a brief lifted from
      // Confluence. The intake screen has nothing to say about provenance if
      // every source has the same answer.
      sourceDocuments: {
        create: [
          {
            title: "Discovery workshop — 12 March",
            sourceType: "workshop_notes",
            sourceProvenance: "workshop_notes",
            sourceTimestamp: new Date("2026-03-12T00:00:00Z"),
            content: WORKSHOP_NOTES,
            checksumHash: contentChecksum(WORKSHOP_NOTES),
          },
          {
            title: "Interview — Tom Bakker, Claims team lead",
            sourceType: "transcript",
            sourceProvenance: "manual_transcription",
            sourceTimestamp: new Date("2026-03-18T00:00:00Z"),
            content: TRANSCRIPT,
            checksumHash: contentChecksum(TRANSCRIPT),
          },
          {
            title: "Compliance requirements — Sander Willems",
            sourceType: "email",
            sourceProvenance: "email",
            sourceTimestamp: new Date("2026-03-21T00:00:00Z"),
            content: EMAIL,
            checksumHash: contentChecksum(EMAIL),
          },
          {
            title: "Claims Portal feature brief v0.3",
            sourceType: "feature_brief",
            sourceProvenance: "confluence_snapshot",
            // No origin date: the Confluence page carried no reliable one, and
            // guessing is exactly what this column exists to avoid.
            content: FEATURE_BRIEF,
            checksumHash: contentChecksum(FEATURE_BRIEF),
          },
        ],
      },
    },
    include: { sourceDocuments: true },
  });

  console.log(`Seeded project "${project.name}" (${project.id})`);
  console.log(`  ${project.sourceDocuments.length} source documents`);
  console.log(`  Open http://localhost:3000/projects/${project.id}/sources`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
