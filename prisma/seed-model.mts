/**
 * Populates the seeded project with a hand-written requirement model.
 *
 * This is what extraction and the drafting jobs would have produced, written by
 * hand so the pack builders, quality engine, traceability view and export can
 * be exercised without an API key. It is also a useful reference for the shape
 * a good model takes.
 *
 * Deliberately imperfect: one requirement has no source, one criterion is
 * untestable, one use case is detailed with no exception flow. Those are there
 * so the quality screen has something true to say.
 *
 * Run with: npm run db:seed:model
 */

import { prisma } from "../lib/db/client";
import { encodeFlowBranches, encodeList } from "../lib/db/mappers";

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: "Claims intake redesign" },
    include: { sourceDocuments: true },
  });

  if (!project) {
    console.error("Run `npm run db:seed` first — the base project is missing.");
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.requirement.count({ where: { projectId: project.id } });
  if (existing > 0) {
    console.log(
      `Project already has ${existing} requirements. Delete the project in the app and re-seed for a clean run.`,
    );
    return;
  }

  const src = (fragment: string): string[] => {
    const match = project.sourceDocuments.find((s) => s.title.includes(fragment));
    return match ? [match.id] : [];
  };

  const workshop = src("workshop");
  const interview = src("Tom Bakker");
  const compliance = src("Compliance");
  const brief = src("feature brief");

  const projectId = project.id;

  // --- Context -------------------------------------------------------------

  await prisma.stakeholder.createMany({
    data: [
      {
        projectId,
        name: "Marieke de Vries",
        role: "Head of Claims",
        notes: "Sponsor. Wants automated first response within one hour.",
        sourceRefsJson: encodeList(workshop),
      },
      {
        projectId,
        name: "Tom Bakker",
        role: "Claims team lead",
        notes:
          "Allocates the daily queue by hand. Wants incomplete claims stopped at submission, and manual claim creation kept for exceptional cases.",
        sourceRefsJson: encodeList([...workshop, ...interview]),
      },
      {
        projectId,
        name: "Priya Nair",
        role: "IT architecture",
        notes:
          "Non-negotiable: all writes to Guidewire go through the existing integration layer.",
        sourceRefsJson: encodeList(workshop),
      },
      {
        projectId,
        name: "Sander Willems",
        role: "Compliance",
        notes:
          "Owns retention, DPIA, subject access and audit attribution requirements.",
        sourceRefsJson: encodeList([...workshop, ...compliance]),
      },
    ],
  });

  await prisma.actor.createMany({
    data: [
      {
        projectId,
        name: "Policyholder",
        description: "Submits and tracks their own claim through the portal.",
        sourceRefsJson: encodeList(brief),
      },
      {
        projectId,
        name: "Claims handler",
        description: "Assesses claims and sets the reserve.",
        sourceRefsJson: encodeList(interview),
      },
      {
        projectId,
        name: "Senior claims handler",
        description:
          "Handles injury claims and claims above €50,000. Only role permitted to see injury claim data.",
        sourceRefsJson: encodeList([...interview, ...compliance]),
      },
      {
        projectId,
        name: "Guidewire integration layer",
        description:
          "The only permitted write path into the policy administration system.",
        sourceRefsJson: encodeList(workshop),
      },
    ],
  });

  await prisma.businessGoal.createMany({
    data: [
      {
        projectId,
        title: "Cut handler data entry in half",
        description:
          "Handlers currently spend around 60% of their time rekeying claims. Self-service submission moves that effort to the customer and frees handlers for assessment.",
        sourceRefsJson: encodeList([...workshop, ...brief]),
      },
      {
        projectId,
        title: "Acknowledge every claim within one hour",
        description:
          "Customers currently wait up to four days for any confirmation. An automated acknowledgement with a claim reference removes the uncertainty that drives status-chasing calls.",
        sourceRefsJson: encodeList([...workshop, ...brief]),
      },
      {
        projectId,
        title: "Reduce status-chasing calls by 30%",
        description:
          "30-40% of inbound calls are customers asking whether their claim arrived. Self-service tracking removes the reason to call.",
        sourceRefsJson: encodeList([...workshop, ...brief]),
      },
    ],
  });

  await prisma.businessRule.createMany({
    data: [
      {
        projectId,
        ruleText:
          "Any claim involving personal injury is assigned to a senior handler, without exception.",
        rationale: "Long-standing policy predating the current team lead.",
        sourceRefsJson: encodeList(interview),
      },
      {
        projectId,
        ruleText: "Any claim with an estimated value above €50,000 is assigned to a senior handler.",
        rationale: "Reserve-setting authority is limited by value.",
        sourceRefsJson: encodeList(interview),
      },
      {
        projectId,
        ruleText:
          "Claim records, including all attachments, are retained for 7 years from the date the claim is closed, then deleted.",
        rationale: "GDPR retention obligation confirmed by Compliance.",
        sourceRefsJson: encodeList(compliance),
      },
      {
        projectId,
        ruleText:
          "Injury claim data is accessible only to senior handlers.",
        rationale:
          "Article 9 special category data — access restriction is a condition of processing it.",
        sourceRefsJson: encodeList(compliance),
      },
      {
        projectId,
        ruleText:
          "Every change to a claim record is attributed to a named actor with a timestamp, including changes originating from a portal submission.",
        rationale: "Hard requirement from the last audit.",
        sourceRefsJson: encodeList(compliance),
      },
    ],
  });

  // --- Requirements --------------------------------------------------------

  const requirements = [
    {
      ref: "REQ-001",
      title: "Policyholder submits a claim through the portal",
      description:
        "A policyholder must be able to submit a motor or property claim without contacting a handler. The submission must capture the policy, the date of loss, the type of loss, a description, and an optional estimated value.",
      requirementType: "functional",
      priority: "critical",
      rationale:
        "Removes the rekeying that consumes roughly 60% of handler time today.",
      sourceRefs: [...workshop, ...brief],
      assumptions: ["Phase one covers private lines only."],
      constraints: ["All writes to Guidewire go through the existing integration layer."],
    },
    {
      ref: "REQ-002",
      title: "Submission is blocked when mandatory information is missing",
      description:
        "The portal must prevent submission until the policy is identified, the date of loss is supplied and the type of loss is selected. Each missing item must be named at the point of failure.",
      requirementType: "functional",
      priority: "critical",
      rationale:
        "Missing information is the single largest delay driver: it triggers an email exchange that adds days to every affected claim.",
      sourceRefs: interview,
      assumptions: [],
      constraints: [],
    },
    {
      ref: "REQ-003",
      title: "Policyholder identifies their policy without a policy number",
      description:
        "Around a quarter of claimants do not know their policy number. The portal must offer an alternative identification path using details the policyholder does know, and must present matching policies for confirmation.",
      requirementType: "functional",
      priority: "high",
      rationale:
        "Without this, a quarter of submissions fail at the first step and fall back to the manual process the portal exists to replace.",
      sourceRefs: interview,
      assumptions: [],
      constraints: [],
    },
    {
      ref: "REQ-004",
      title: "Claim reference and acknowledgement issued on submission",
      description:
        "On successful submission the policyholder must receive a claim reference immediately, and an acknowledgement within one hour. The acknowledgement must not contain wording that could be read as accepting liability.",
      requirementType: "functional",
      priority: "critical",
      rationale:
        "Removes the four-day silence that generates most status-chasing calls.",
      sourceRefs: [...workshop, ...compliance, ...brief],
      assumptions: ["Acknowledgement wording will be approved by Legal before go-live."],
      constraints: [],
    },
    {
      ref: "REQ-005",
      title: "Handler can create a claim manually",
      description:
        "A handler must be able to open a claim on behalf of a policyholder who cannot use the portal, including where policy documents are unavailable. This path must not require the fields the portal enforces.",
      requirementType: "functional",
      priority: "high",
      rationale:
        "Explicitly requested to preserve handling of distressed customers — a fire claim from a hotel room cannot be blocked on a missing policy number.",
      sourceRefs: interview,
      assumptions: [],
      constraints: [],
    },
    {
      ref: "REQ-006",
      title: "Uploaded attachments are stored against the claim record",
      description:
        "Photographs and documents supplied at submission must be stored against the claim in the system of record, subject to the same retention rules as the claim itself.",
      requirementType: "functional",
      priority: "high",
      rationale:
        "Attachments currently sit in mailboxes outside the retention policy — a compliance gap as well as a loss risk.",
      sourceRefs: [...workshop, ...compliance],
      assumptions: [],
      constraints: ["7-year retention from claim closure applies to attachments."],
    },
    {
      ref: "REQ-007",
      title: "Portal remains available during storm peaks",
      description:
        "The portal must handle a sustained submission rate of three times the weekly average without degradation. Observed peak is 700 claims in one week against a 240 average.",
      requirementType: "non_functional",
      priority: "high",
      rationale:
        "Storm weeks are precisely when the manual process fails; a portal that fails with it delivers nothing.",
      sourceRefs: [...workshop, ...interview],
      assumptions: [],
      constraints: [],
    },
    {
      ref: "REQ-008",
      title: "Portal meets WCAG 2.2 AA",
      description:
        "All portal journeys must conform to WCAG 2.2 level AA, verified by audit before go-live. The customer base skews over 60.",
      requirementType: "non_functional",
      priority: "high",
      rationale: "Accessibility is stated in the brief and the book skews older.",
      sourceRefs: brief,
      assumptions: [],
      constraints: [],
    },
    {
      // Deliberately unsourced — the quality engine should flag this.
      ref: "REQ-009",
      title: "Portal should be fast and intuitive",
      description: "The portal needs to be easy to use and efficient for customers.",
      requirementType: "non_functional",
      priority: "medium",
      rationale: "",
      sourceRefs: [],
      assumptions: [],
      constraints: [],
    },
  ];

  for (const requirement of requirements) {
    const { sourceRefs, assumptions, constraints, ...rest } = requirement;
    await prisma.requirement.create({
      data: {
        projectId,
        ...rest,
        status: "draft",
        owner: "",
        assumptionsJson: encodeList(assumptions),
        constraintsJson: encodeList(constraints),
        sourceRefsJson: encodeList(sourceRefs),
      },
    });
  }

  const byRef = new Map(
    (await prisma.requirement.findMany({ where: { projectId } })).map((r) => [r.ref, r]),
  );

  // --- Use cases -----------------------------------------------------------

  await prisma.useCase.create({
    data: {
      projectId,
      ref: "UC-001",
      requirementId: byRef.get("REQ-001")!.id,
      title: "Submit a motor or property claim",
      scopeLevel: "detailed",
      primaryActor: "Policyholder",
      trigger: "The policyholder selects “Report a claim” in the portal.",
      supportingActorsJson: encodeList(["Guidewire integration layer"]),
      preconditionsJson: encodeList([
        "The policyholder has an active private lines policy.",
        "The policyholder has been authenticated.",
      ]),
      postconditionsJson: encodeList([
        "A claim record exists in Guidewire with a claim reference.",
        "The submission is attributed to the policyholder with a timestamp.",
      ]),
      mainFlowJson: encodeList([
        "The policyholder identifies their policy.",
        "The system confirms the matched policy and shows its cover.",
        "The policyholder selects the type of loss and enters the date of loss.",
        "The policyholder describes the loss and optionally enters an estimated value.",
        "The policyholder uploads supporting photographs and documents.",
        "The system validates that all mandatory information is present.",
        "The system creates the claim through the Guidewire integration layer.",
        "The system issues a claim reference and confirms submission.",
      ]),
      alternateFlowsJson: encodeFlowBranches([
        {
          name: "Policy identified without a policy number",
          steps: [
            "The policyholder chooses to search by name and postcode.",
            "The system lists matching policies.",
            "The policyholder confirms which policy the claim relates to.",
          ],
        },
      ]),
      exceptionFlowsJson: encodeFlowBranches([
        {
          name: "Mandatory information missing",
          steps: [
            "The system names each missing item.",
            "Submission is blocked until they are supplied.",
          ],
        },
        {
          name: "Integration layer unavailable",
          steps: [
            "The system retains the submission and informs the policyholder it has been received.",
            "The system retries creation and alerts operations if it continues to fail.",
          ],
        },
      ]),
      sourceRefsJson: encodeList([...workshop, ...interview, ...brief]),
    },
  });

  await prisma.useCase.create({
    data: {
      projectId,
      ref: "UC-002",
      requirementId: byRef.get("REQ-005")!.id,
      // Detailed with no exception flow — the quality engine should flag it.
      title: "Handler opens a claim on behalf of a policyholder",
      scopeLevel: "detailed",
      primaryActor: "Claims handler",
      trigger: "A policyholder contacts the claims team by phone.",
      supportingActorsJson: encodeList([]),
      preconditionsJson: encodeList(["The handler is authenticated."]),
      postconditionsJson: encodeList(["A claim record exists with a claim reference."]),
      mainFlowJson: encodeList([
        "The handler searches for the policy using whatever details the customer can give.",
        "The handler records the type and date of loss.",
        "The handler creates the claim.",
        "The handler gives the claim reference to the customer.",
      ]),
      alternateFlowsJson: encodeFlowBranches([]),
      exceptionFlowsJson: encodeFlowBranches([]),
      sourceRefsJson: encodeList(interview),
    },
  });

  await prisma.useCase.create({
    data: {
      projectId,
      ref: "UC-003",
      requirementId: byRef.get("REQ-004")!.id,
      title: "Track claim status",
      scopeLevel: "high_level",
      primaryActor: "Policyholder",
      trigger: "The policyholder opens their claim in the portal.",
      supportingActorsJson: encodeList([]),
      preconditionsJson: encodeList([]),
      postconditionsJson: encodeList([]),
      mainFlowJson: encodeList([
        "The policyholder opens the portal and selects their claim.",
        "The system shows the current status and any outstanding request for information.",
        "The policyholder responds to any outstanding request.",
      ]),
      alternateFlowsJson: encodeFlowBranches([]),
      exceptionFlowsJson: encodeFlowBranches([]),
      sourceRefsJson: encodeList(brief),
    },
  });

  // --- Acceptance criteria -------------------------------------------------

  const criteria: {
    ref: string;
    requirementRef: string;
    criterionType: string;
    text: string;
  }[] = [
    {
      ref: "AC-001",
      requirementRef: "REQ-002",
      criterionType: "functional",
      text: "Given a submission with no date of loss, when the policyholder submits, then submission is rejected and the missing field is named.",
    },
    {
      ref: "AC-002",
      requirementRef: "REQ-002",
      criterionType: "functional",
      text: "Given a submission with no identified policy, when the policyholder submits, then submission is rejected and the policy identification step is shown.",
    },
    {
      ref: "AC-003",
      requirementRef: "REQ-004",
      criterionType: "business",
      text: "Given a successful submission, when the claim is created, then an acknowledgement is sent within 1 hour and contains the claim reference.",
    },
    {
      ref: "AC-004",
      requirementRef: "REQ-004",
      criterionType: "business",
      text: "Given an acknowledgement is sent, when its wording is reviewed by Legal, then it contains no statement that accepts or implies acceptance of liability.",
    },
    {
      ref: "AC-005",
      requirementRef: "REQ-003",
      criterionType: "functional",
      text: "Given a policyholder who does not know their policy number, when they search by name and postcode, then matching policies are listed for confirmation.",
    },
    {
      ref: "AC-006",
      requirementRef: "REQ-007",
      criterionType: "non_functional",
      text: "Given a sustained submission rate of 720 claims per week, when submissions are made, then the 95th percentile submission response time is under 3 seconds.",
    },
    {
      // Deliberately untestable — the quality engine should flag it.
      ref: "AC-007",
      requirementRef: "REQ-009",
      criterionType: "non_functional",
      text: "The portal is user-friendly and efficient.",
    },
  ];

  for (const criterion of criteria) {
    const { requirementRef, ...rest } = criterion;
    const requirement = byRef.get(requirementRef)!;
    await prisma.acceptanceCriterion.create({
      data: {
        projectId,
        ...rest,
        requirementId: requirement.id,
        testabilityScore: 0,
        sourceRefsJson: requirement.sourceRefsJson,
      },
    });
  }

  // Score them through the real engine rather than hard-coding numbers.
  const { scoreTestability } = await import("../lib/quality/testability");
  for (const row of await prisma.acceptanceCriterion.findMany({ where: { projectId } })) {
    await prisma.acceptanceCriterion.update({
      where: { id: row.id },
      data: { testabilityScore: scoreTestability(row.text) },
    });
  }

  // --- Dependencies --------------------------------------------------------

  await prisma.dependency.createMany({
    data: [
      {
        projectId,
        fromRequirementId: byRef.get("REQ-001")!.id,
        toRequirementId: byRef.get("REQ-003")!.id,
        dependencyType: "depends_on",
        notes: "Submission cannot start until the policy is identified.",
      },
      {
        projectId,
        fromRequirementId: byRef.get("REQ-002")!.id,
        toRequirementId: byRef.get("REQ-005")!.id,
        dependencyType: "conflicts_with",
        notes:
          "Mandatory-field enforcement must not apply to the manual handler path — the two need an explicit boundary.",
      },
      {
        projectId,
        fromRequirementId: byRef.get("REQ-006")!.id,
        toRequirementId: byRef.get("REQ-001")!.id,
        dependencyType: "depends_on",
        notes: "Attachments are captured as part of submission.",
      },
    ],
  });

  // --- Assumption / constraint / risk register -----------------------------

  const registerEntries: { type: string; text: string; sources: string[] }[] = [
    {
      type: "assumption",
      text: "Phase one covers private lines only; whether commercial claims are included was raised and not resolved.",
      sources: workshop,
    },
    {
      type: "assumption",
      text: "The existing Guidewire integration layer can support the required claim creation volume without change.",
      sources: workshop,
    },
    {
      type: "constraint",
      text: "All writes to Guidewire must go through the existing integration layer; direct database writes are not permitted.",
      sources: workshop,
    },
    {
      type: "constraint",
      text: "A DPIA must be completed and signed off before go-live if the portal accepts injury claims.",
      sources: compliance,
    },
    {
      type: "constraint",
      text: "Claim data, including attachments, is retained for 7 years from claim closure and then deleted.",
      sources: compliance,
    },
    {
      type: "risk",
      text: "If the portal enforces mandatory fields too rigidly, distressed customers without their documents will be blocked from claiming at all.",
      sources: interview,
    },
    {
      type: "risk",
      text: "Identity assurance is unresolved: knowing the policy number has been ruled insufficient, but no alternative has been agreed.",
      sources: compliance,
    },
    {
      type: "risk",
      text: "Storm peaks are three times normal volume and are exactly when the portal matters most; a capacity failure would land at the worst moment.",
      sources: [...workshop, ...interview],
    },
  ];

  for (const entry of registerEntries) {
    await prisma.extractedInsight.create({
      data: {
        projectId,
        sourceDocumentId: entry.sources[0] ?? project.sourceDocuments[0].id,
        insightType: entry.type,
        rawText: entry.text,
        normalizedText: entry.text,
        confidence: 0.9,
        status: "accepted",
        userEdited: true,
      },
    });
  }

  const counts = {
    requirements: await prisma.requirement.count({ where: { projectId } }),
    useCases: await prisma.useCase.count({ where: { projectId } }),
    criteria: await prisma.acceptanceCriterion.count({ where: { projectId } }),
    rules: await prisma.businessRule.count({ where: { projectId } }),
    register: await prisma.extractedInsight.count({ where: { projectId } }),
  };

  console.log(`Seeded requirement model for "${project.name}":`);
  console.log(
    `  ${counts.requirements} requirements, ${counts.useCases} use cases, ${counts.criteria} criteria`,
  );
  console.log(
    `  ${counts.rules} business rules, ${counts.register} register entries, 3 dependencies`,
  );
  console.log(`  Open http://localhost:3000/projects/${projectId}/requirements`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
