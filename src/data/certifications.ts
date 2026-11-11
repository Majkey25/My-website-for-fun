// Public credentials from LinkedIn, checked on 2026-11-11.
interface Certificate {
  name: string;
  issued: string;
  expires?: string;
  href?: string;
}

interface CertificationGroup {
  org: string;
  note: { cs: string; en: string };
  list: Certificate[];
}

export const certifications: CertificationGroup[] = [
  {
    org: 'Microsoft',
    note: {
      cs: 'certifikace Microsoft',
      en: 'Microsoft certifications',
    },
    list: [
      {
        name: 'Microsoft Certified: Azure AI Fundamentals',
        issued: '2023-04',
        href: 'https://www.credly.com/badges/d655a57d-c685-4c8e-b890-6e0a138c9f3e/public_url',
      },
      {
        name: 'Microsoft Certified: Azure Fundamentals',
        issued: '2023-03',
        href: 'https://www.credly.com/badges/0fe7a367-92a0-4860-8f2d-da934ddf7fed/public_url',
      },
    ],
  },
  {
    org: 'Google',
    note: {
      cs: 'odznaky dovedností a absolvované kurzy',
      en: 'skill badges and completed courses',
    },
    list: [
      {
        name: 'Inspect Rich Documents with Gemini Multimodality and Multimodal RAG Skill Badge',
        issued: '2026-10',
        href: 'https://www.credly.com/badges/7e145319-7db6-4d66-80d4-8b9ea31a7181/',
      },
      {
        name: 'Implement CI/CD Pipelines on Google Cloud Skill Badge',
        issued: '2026-10',
        href: 'https://www.credly.com/badges/dcb1b9be-8c7d-4654-8978-517b0522d044',
      },
      {
        name: 'Orchestrate Multi-agent Workflows with Gemini Enterprise',
        issued: '2026-10',
        href: 'https://www.credly.com/badges/b9a912cf-3330-40bf-80ef-91ae292005ff/',
      },
      {
        name: 'Engineer AI Agents with Agent Development Kit (ADK)',
        issued: '2026-10',
        href: 'https://www.credly.com/badges/19cbcefa-bc8d-464f-b690-3c396df2cc06/',
      },
      {
        name: 'Google AI Essentials',
        issued: '2026-04',
        href: 'https://www.credly.com/badges/3787be6e-4eff-4beb-b0c0-479ef4e411ca/linked_in_profile',
      },
    ],
  },
  {
    org: 'Anthropic',
    note: {
      cs: 'absolvované kurzy',
      en: 'completed courses',
    },
    list: [
      {
        name: 'Certificate of completion: Teaching the AI Fluency Framework',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/cpr8dpqqqdb2',
      },
      {
        name: 'Model Context Protocol: Advanced Topics',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/5593397zi9a7',
      },
      {
        name: 'Certificate of completion: Introduction to subagents',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/oorzetvxjqqs',
      },
      {
        name: 'Certificate of completion: Introduction to Model Context Protocol',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/snkqm6sqkvz4',
      },
      {
        name: 'Certificate of completion: Introduction to Claude Cowork',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/oz4rbbof7j39',
      },
      {
        name: 'Certificate of completion: Introduction to agent skills',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/64jbng8vrv7c',
      },
      {
        name: "Claude with Google Cloud's Vertex AI",
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/aen98v4ud776',
      },
      {
        name: 'Claude in Amazon Bedrock',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/jdotzad9eut2',
      },
      {
        name: 'Certificate of completion: Claude Platform 101',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/hhai4jqhx24k',
      },
      {
        name: 'Certificate of completion: Claude Code in Action',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/6symjgnjqh4i',
      },
      {
        name: 'Certificate of completion: Claude 101',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/z2y9f5tpros3',
      },
      {
        name: 'Certificate of completion: Building with the Claude API',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/cqozzdig5hy6',
      },
      {
        name: 'Certificate of Completion: Al Fluency Framework & Foundations',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/6ynvxoxcxxq2',
      },
      {
        name: 'Certificate of completion: AI Fluency for students',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/tkwiw3oedmwn',
      },
      {
        name: 'Certificate of Completion: AI Fluency for Small Businesses',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/paepuoc9g6gp',
      },
      {
        name: 'Certificate of completion: AI Fluency for K-12 Educators',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/38t5qxcipwyw',
      },
      {
        name: 'Certificate of completion: AI Fluency for nonprofits',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/q2k686oxzzdn',
      },
      {
        name: 'Certificate of completion: AI Fluency for educators',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/5b5vqgg255ub',
      },
      {
        name: 'Certificate of Completion: AI Fluency for Builders',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/pxpqyww7kg7u',
      },
      {
        name: 'Certificate of completion: AI Capabilities and Limitations',
        issued: '2026-07',
        href: 'https://verify.skilljar.com/c/eedfmxhjdgz3',
      },
    ],
  },
  {
    org: 'OpenAI',
    note: {
      cs: 'absolvované kurzy a vzdělávací programy',
      en: 'completed courses and learning pathways',
    },
    list: [
      {
        name: 'AI for College Students',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/38d1c668-4154-409d-8a60-f0a97118b1b4',
      },
      {
        name: 'AI for Educators',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/2c20a77e-1cd4-48be-9940-0918c533a9a9',
      },
      {
        name: 'AI Leadership',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/d86b4896-4118-418c-8ca0-11dc39eff6b3',
      },
      {
        name: 'Apply AI at Work Pathway Completion',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/ae2ce6d3-c687-462e-9e62-dff0bd3d52cf',
      },
      {
        name: 'Applied AI Foundations',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/a30eed2d-1b88-4371-b071-a058575fed71',
      },
      {
        name: 'Agents and Workflows',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/7a802ea5-5c74-41de-a4af-c1cbdfc7a431',
      },
      {
        name: 'Build with AI - Codex Pathway Completion',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/33128134-b4d8-49a1-a207-41fa789a5424',
      },
      {
        name: 'Get Started with Codex',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/18264ecd-6579-480a-b339-5286dd1675b7',
      },
      {
        name: 'Build With AI - OpenAI API Pathway Completion',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/d2d3740d-9fbf-4437-99c4-fe00e2e60633',
      },
      {
        name: 'Scope AI Solutions',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/7c972460-3778-4413-b576-e2836158e16a',
      },
      {
        name: 'Extend Codex Workflows',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/38ccc53d-0399-48b1-b10a-085b85f7ce4a',
      },
      {
        name: 'Scale Codex Across Teams and Systems',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/9c6d0008-87f6-4cbe-ba23-218828b33d0e',
      },
      {
        name: 'Evaluate AI Applications',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/e96f2c2d-ccc9-48cb-b439-719cc3ab0d31',
      },
      {
        name: 'Optimize AI Application Performance',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/1a53891c-e7fd-40ef-8d90-cbb440c22945',
      },
      {
        name: 'Build with Retrieval-Augmented Generation',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/be3f4a4d-8893-4f2f-ae58-ca62341d9c07',
      },
      {
        name: 'Design and Build Agentic Systems',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/edc70549-b574-436d-80ea-b5096afc95b4',
      },
      {
        name: 'AI Foundations',
        issued: '2026-09',
        expires: '2027-03',
        href: 'https://oaiacademy.credential.net/ad4c6f09-4245-40ee-907a-934ea88ac9ae',
      },
    ],
  },
  {
    org: 'AWS Training and Certification',
    note: {
      cs: 'absolvovaný kurz',
      en: 'completed course',
    },
    list: [
      {
        name: 'Foundations of Prompt Engineering',
        issued: '2026-08',
        href: 'https://skillbuilder.aws/learn/VF6H4SZ1BU/foundations-of-prompt-engineering/7U8XFUVXDT',
      },
    ],
  },
  {
    org: 'University of Cambridge',
    note: {
      cs: 'zkouška z angličtiny',
      en: 'English exam',
    },
    list: [
      {
        name: 'Cambridge B2 First Certificate (FCE)',
        issued: '2024-06',
      },
    ],
  },
  {
    org: 'IBM',
    note: {
      cs: 'odznaky dovedností a absolvované kurzy',
      en: 'skill badges and completed courses',
    },
    list: [
      {
        name: 'Lifelong Professional Skills',
        issued: '2026-05',
        href: 'https://www.credly.com/badges/99347815-4f15-4808-a53b-7b0236f767f8/',
      },
      {
        name: 'AI Fundamentals: Foundations for Understanding AI',
        issued: '2026-05',
        href: 'https://www.credly.com/badges/7bf8452e-1c9c-49b4-9de2-1c39a7df43de/',
      },
      {
        name: 'Artificial Intelligence Fundamentals',
        issued: '2026-04',
        href: 'https://www.credly.com/badges/b44409bc-d7fc-45bf-a777-b0647832113c/linked_in_profile',
      },
    ],
  },
  {
    org: 'Cisco',
    note: {
      cs: 'absolvované kurzy',
      en: 'completed courses',
    },
    list: [
      {
        name: 'Data Analytics Essentials',
        issued: '2026-05',
        href: 'https://www.credly.com/badges/9a2533a7-cd8d-478a-88de-6c4166a12a49/linked_in_profile',
      },
      {
        name: 'Introduction to Modern AI',
        issued: '2026-05',
        href: 'https://www.credly.com/badges/cdca08b4-673c-486f-86fc-20f9cfb3ce0e/public_url',
      },
      {
        name: 'Endpoint Security',
        issued: '2026-05',
        href: 'https://www.credly.com/badges/f165ed46-2132-4a19-bd7f-84a43ef26c59/public_url',
      },
      {
        name: 'Introduction to Data Science',
        issued: '2026-04',
        href: 'https://www.credly.com/badges/233b6cb5-f714-4c9c-b228-638f718bb1ac/linked_in_profile',
      },
    ],
  },
  {
    org: 'International Telecommunication Union',
    note: {
      cs: 'absolvovaný kurz',
      en: 'completed course',
    },
    list: [
      {
        name: 'AI governance: fundamentals | AI and Data Governance',
        issued: '2026-04',
        href: 'https://credentials.academy.itu.int/4ce60f07-8e23-4886-b80e-fcfb42df6664',
      },
    ],
  },
  {
    org: 'University of Helsinki & MinnaLearn',
    note: {
      cs: 'absolvovaný kurz',
      en: 'completed course',
    },
    list: [
      {
        name: 'Elements of AI',
        issued: '2026-04',
        href: 'https://certificates.mooc.fi/validate/9fbdxhfp5ya',
      },
    ],
  },
];
