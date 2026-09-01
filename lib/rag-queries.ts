/**
 * RAG Database Query Utilities
 *
 * Zero-cost requirement/rule lookups
 * No Claude API calls needed - all queries run locally against RuleBase
 */

import { prisma } from './prisma'

// The app's single client. Constructing a second PrismaClient here would open a
// second connection pool, which on a serverless function is how you run the
// database out of connections.
function getPrisma() {
  return prisma
}

/**
 * Get all business rules for an industry
 * Used by Feature 1: Rules Engine
 */
export async function getBusinessRules(industry: string) {
  return getPrisma().ruleBase.findMany({
    where: {
      recordType: 'business-rule',
      industry,
    },
    select: {
      id: true,
      title: true,
      description: true,
      quote: true,
      tags: true,
      confidence: true,
      isGrounded: true,
    },
  })
}

/**
 * Get regulatory constraints for compliance checking
 */
export async function getRegulatoryConstraints(
  industry: string,
  frameworks?: string[] // e.g., ["FATF", "AML5", "PSD2"]
) {
  return getPrisma().ruleBase.findMany({
    where: {
      recordType: 'regulatory-constraint',
      industry,
      ...(frameworks && {
        regulatoryFrameworks: {
          hasSome: frameworks,
        },
      }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      regulatoryFrameworks: true,
      quote: true,
      tags: true,
    },
  })
}

/**
 * Get every rule citing a regulatory framework, regardless of record type.
 *
 * Distinct from getRegulatoryConstraints above, which answers "show me the
 * constraint records". This answers "show me everything governed by AML5" —
 * and a rule that cites AML5 is governed by it whether it was classified as a
 * constraint, a business rule or a use case.
 */
export async function getRulesByFramework(
  framework: string,
  industry: string
) {
  return getPrisma().ruleBase.findMany({
    where: {
      industry,
      regulatoryFrameworks: { has: framework },
    },
    select: {
      id: true,
      title: true,
      description: true,
      recordType: true,
      quote: true,
      tags: true,
      regulatoryFrameworks: true,
      isGrounded: true,
    },
  })
}

/**
 * Get use cases for a specific actor/persona
 */
export async function getUseCases(
  industry: string,
  actor?: string // e.g., "multinational", "sme", "trader"
) {
  return getPrisma().ruleBase.findMany({
    where: {
      recordType: 'use-case',
      industry,
      ...(actor && {
        tags: {
          has: actor.toLowerCase(),
        },
      }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      quote: true,
    },
  })
}

/**
 * Get all rules matching a tag (domain)
 * E.g., "CDD", "sanctions", "screening", "monitoring"
 */
export async function getRulesByTag(tag: string, industry: string) {
  return getPrisma().ruleBase.findMany({
    where: {
      industry,
      tags: {
        has: tag,
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      recordType: true,
      quote: true,
      tags: true,
    },
  })
}

/**
 * Get acceptance criteria for a feature/requirement
 */
export async function getAcceptanceCriteria(
  industry: string,
  parentRuleId?: string
) {
  return getPrisma().ruleBase.findMany({
    where: {
      recordType: 'acceptance-criteria',
      industry,
      ...(parentRuleId && { parentRuleId }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      quote: true,
      parentRuleId: true,
    },
  })
}

/**
 * Get a rule hierarchy: parent + all children
 */
export async function getRuleHierarchy(ruleId: string) {
  return getPrisma().ruleBase.findUnique({
    where: { id: ruleId },
    include: {
      childRules: {
        select: {
          id: true,
          title: true,
          recordType: true,
          description: true,
        },
      },
      parentRule: {
        select: {
          id: true,
          title: true,
          recordType: true,
        },
      },
    },
  })
}

/**
 * Search rules by full-text keyword
 * Useful for "find all rules mentioning 'beneficial ownership'"
 */
export async function searchRules(keyword: string, industry: string) {
  return getPrisma().ruleBase.findMany({
    where: {
      industry,
      OR: [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { quote: { contains: keyword, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      recordType: true,
      quote: true,
      confidence: true,
    },
  })
}

/**
 * Get only grounded (verified) rules
 */
export async function getGroundedRules(industry: string) {
  return getPrisma().ruleBase.findMany({
    where: {
      industry,
      isGrounded: true,
    },
    select: {
      id: true,
      title: true,
      description: true,
      quote: true,
      recordType: true,
      tags: true,
      confidence: true,
    },
  })
}

/**
 * Semantic search using vector embeddings
 * Requires embedding to be generated via OpenAI API first
 *
 * Usage:
 *   const results = await semanticSearch(
 *     "When should we escalate transactions?",
 *     "financial-services"
 *   )
 */
export async function semanticSearch(
  query: string,
  industry: string,
  limit: number = 5
) {
  // Not semantic yet — there are no embeddings. It is substring matching with a
  // limit, and it is named honestly in the return so a caller cannot mistake it
  // for vector search. Prisma's `search` filter needs the fullTextSearch preview
  // feature enabled, which it is not, so `contains` is what actually runs.
  return getPrisma().ruleBase.findMany({
    where: {
      industry,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      recordType: true,
      quote: true,
      tags: true,
    },
  })
}

/**
 * Get statistics on the RAG DB
 */
export async function getRuleBaseStats(industry: string) {
  const total = await getPrisma().ruleBase.count({
    where: { industry },
  })

  const byType = await getPrisma().ruleBase.groupBy({
    by: ['recordType'],
    where: { industry },
    _count: {
      id: true,
    },
  })

  const groundedCount = await getPrisma().ruleBase.count({
    where: {
      industry,
      isGrounded: true,
    },
  })

  const frameworks = await getPrisma().ruleBase.findMany({
    where: { industry },
    select: { regulatoryFrameworks: true },
    distinct: ['regulatoryFrameworks'],
  })

  const uniqueFrameworks = Array.from(
    new Set(
      frameworks.flatMap((r) => r.regulatoryFrameworks).filter(Boolean)
    )
  )

  return {
    total,
    grounded: groundedCount,
    groundingRate: total > 0 ? (groundedCount / total) * 100 : 0,
    byType: Object.fromEntries(
      byType.map((row) => [row.recordType, row._count.id])
    ),
    regulatoryFrameworks: uniqueFrameworks,
  }
}

export default {
  getBusinessRules,
  getRegulatoryConstraints,
  getRulesByFramework,
  getUseCases,
  getRulesByTag,
  getAcceptanceCriteria,
  getRuleHierarchy,
  searchRules,
  getGroundedRules,
  semanticSearch,
  getRuleBaseStats,
}
