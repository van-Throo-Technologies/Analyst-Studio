import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  CDD: ['customer due diligence', 'CDD', 'identify', 'verification', 'onboarding'],
  Sanctions: ['sanctions', 'screening', 'AML list', 'OFAC', 'terrorist', 'PEP'],
  Monitoring: ['ongoing monitoring', 'transaction monitoring', 'suspicious activity'],
  Enhanced: ['enhanced due diligence', 'EDD', 'higher risk', 'politically exposed'],
  Beneficial: ['beneficial owner', 'ultimate owner', 'ownership', 'UBO'],
  AML: ['anti-money laundering', 'AML', 'money laundering'],
  KYC: ['know your customer', 'KYC', 'customer identity'],
  Retention: ['retention', 'record keeping', 'documentation'],
}

const FRAMEWORK_KEYWORDS: Record<string, string[]> = {
  FATF: ['FATF', '40 recommendations'],
  'AML5': ['AML5', 'Fifth Directive', 'AMLD5'],
  PSD2: ['PSD2', 'Payment Services Directive'],
  MiFID: ['MiFID', 'Markets in Financial Instruments'],
  Wolfsberg: ['Wolfsberg', 'correspondent banking'],
  'EU-AI-Act': ['EU AI Act', 'AI Act', 'artificial intelligence'],
}

function extractTags(title: string, description: string): string[] {
  const content = `${title} ${description}`.toLowerCase()
  const tags: Set<string> = new Set()
  for (const [tag, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => content.includes(kw.toLowerCase()))) {
      tags.add(tag)
    }
  }
  return Array.from(tags)
}

function extractFrameworks(title: string, description: string, quote?: string): string[] {
  const content = `${title} ${description} ${quote || ''}`.toLowerCase()
  const frameworks: Set<string> = new Set()
  for (const [framework, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
    if (keywords.some((kw) => content.toLowerCase().includes(kw.toLowerCase()))) {
      frameworks.add(framework)
    }
  }
  return Array.from(frameworks)
}

async function seedRuleBase() {
  console.log('🌱 Starting RuleBase seed...')
  try {
    const requirements = await prisma.requirement.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        priority: true,
        actor: true,
        trigger: true,
        happyPath: true,
        bdDAC: true,
        checklistAC: true,
        businessRule: true,
        completionScore: true,
        createdAt: true,
      },
    })

    if (requirements.length === 0) {
      console.log('⚠️  No requirements found.')
      return
    }

    console.log(`📋 Found ${requirements.length} requirements to seed`)

    const ruleRecords = requirements.map((req) => {
      let recordType = 'acceptance-criteria'
      if (req.type?.includes('functional') || req.businessRule) {
        recordType = 'business-rule'
      } else if (req.type?.includes('use-case') || req.actor || req.trigger) {
        recordType = 'use-case'
      } else if (req.type?.includes('constraint')) {
        recordType = 'regulatory-constraint'
      }

      return {
        recordType,
        title: req.title,
        description: req.description,
        quote: req.bdDAC || req.checklistAC,
        sourceDocument: 'kyc-extraction',
        tags: extractTags(req.title, req.description),
        regulatoryFrameworks: extractFrameworks(req.title, req.description),
        industry: 'financial-services',
        confidence: req.completionScore ? req.completionScore / 100 : 0.75,
        isGrounded: !!(req.bdDAC || req.checklistAC),
        isPinned: false,
        version: 1,
      }
    })

    console.log(`⚙️  Inserting ${ruleRecords.length} rules into RuleBase...`)
    const result = await prisma.ruleBase.createMany({
      data: ruleRecords,
      skipDuplicates: true,
    })

    console.log(`✅ Seeded ${result.count} rules successfully`)

    const stats = await prisma.ruleBase.groupBy({
      by: ['recordType'],
      _count: { id: true },
    })

    console.log('\n📊 Rule Distribution:')
    stats.forEach((stat) => {
      console.log(`   ${stat.recordType}: ${stat._count.id}`)
    })

    const groundedCount = await prisma.ruleBase.count({
      where: { isGrounded: true, industry: 'financial-services' },
    })

    console.log(`\n🎯 Grounding Rate: ${((groundedCount / result.count) * 100).toFixed(1)}%\n`)
  } catch (error) {
    console.error('❌ Seed failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedRuleBase().catch((err) => {
  console.error(err)
  process.exit(1)
})