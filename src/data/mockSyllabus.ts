import type { Module, SyllabusVersion } from '../types';

type DayDef = [string, string[]];
type WeekDef = [string, DayDef[]];
type ModDef = [string, WeekDef[]];

export const SYLLABUS_DEFS: Record<string, ModDef[]> = {
  C02: [
    ['SQL Foundations', [
      ['Week 1', [
        ['Database Concepts', ['What is a Database?', 'RDBMS Overview', 'Tables, Rows and Columns', 'Installing PostgreSQL']],
        ['Basic Queries', ['SELECT Statement', 'WHERE Clause', 'ORDER BY', 'LIMIT and OFFSET', 'Practice Queries']],
        ['Filtering', ['AND, OR, NOT', 'IN and BETWEEN', 'LIKE Patterns', 'NULL Handling', 'Filtering Exercises']],
      ]],
      ['Week 2', [
        ['Aggregation', ['COUNT, SUM, AVG', 'GROUP BY', 'HAVING', 'Aggregation Exercises']],
        ['Joins', ['INNER JOIN', 'LEFT JOIN', 'RIGHT and FULL JOIN', 'Self Join', 'Join Exercises']],
      ]],
    ]],
    ['Advanced SQL', [
      ['Week 3', [
        ['Subqueries', ['Scalar Subqueries', 'Correlated Subqueries', 'EXISTS', 'Subquery Exercises']],
        ['Window Functions', ['ROW_NUMBER', 'RANK and DENSE_RANK', 'LAG and LEAD', 'Running Totals']],
      ]],
    ]],
  ],
  C03: [
    ['HTML Essentials', [
      ['Week 1', [
        ['HTML Basics', ['Document Structure', 'Headings and Paragraphs', 'Links and Images', 'Lists']],
        ['Forms & Tables', ['Form Elements', 'Input Types', 'Table Markup', 'Accessibility Basics']],
        ['Semantic HTML', ['Header, Nav, Main, Footer', 'Article and Section', 'SEO Basics', 'Semantic Page Exercise']],
      ]],
    ]],
    ['CSS Styling', [
      ['Week 2', [
        ['CSS Basics', ['Selectors', 'Colors and Units', 'Box Model', 'Typography']],
        ['Layouts', ['Flexbox', 'CSS Grid', 'Positioning', 'Layout Exercises']],
        ['Responsive Design', ['Media Queries', 'Mobile-first Approach', 'Responsive Images', 'Mini Project: Landing Page']],
      ]],
    ]],
  ],
  C04: [
    ['JavaScript Core', [
      ['Week 1', [
        ['JS Basics', ['Variables: var, let, const', 'Data Types', 'Operators', 'Console and Debugging']],
        ['Control Flow', ['if/else and switch', 'Loops', 'Truthy and Falsy', 'Control Flow Exercises']],
        ['Functions', ['Function Declarations', 'Arrow Functions', 'Scope and Hoisting', 'Closures', 'Function Exercises']],
      ]],
      ['Week 2', [
        ['Arrays & Objects', ['Array Methods', 'map, filter, reduce', 'Objects and Destructuring', 'Spread and Rest']],
        ['DOM', ['Selecting Elements', 'Events', 'Modifying the DOM', 'DOM Mini Project']],
      ]],
    ]],
    ['Async JavaScript', [
      ['Week 3', [
        ['Asynchronous JS', ['Callbacks', 'Promises', 'async/await', 'Fetch API', 'Error Handling']],
      ]],
    ]],
  ],
  C05: [
    ['Django Basics', [
      ['Week 1', [
        ['Introduction to Django', ['What is Django?', 'MVT Architecture', 'Installing Django', 'Creating a Project']],
        ['Apps & Settings', ['Creating an App', 'settings.py Walkthrough', 'INSTALLED_APPS', 'Running the Dev Server']],
        ['Models', ['Defining Models', 'Field Types', 'Migrations', 'Django Admin Registration', 'Model Exercises']],
      ]],
      ['Week 2', [
        ['ORM Queries', ['QuerySets', 'Filtering and Lookups', 'Related Objects', 'Aggregation in ORM']],
        ['Views & URL Routing', ['Function-based Views', 'URL Patterns', 'Path Converters', 'Class-based Views', 'Views Exercise']],
        ['Templates', ['Template Syntax', 'Template Inheritance', 'Static Files', 'Context Processors']],
      ]],
    ]],
    ['Django in Practice', [
      ['Week 3', [
        ['Forms', ['Django Forms', 'ModelForms', 'Validation', 'CSRF Protection']],
        ['Authentication', ['User Model', 'Login and Logout', 'Permissions', 'Auth Exercises']],
      ]],
    ]],
  ],
  C06: [
    ['FastAPI Fundamentals', [
      ['Week 1', [
        ['Getting Started', ['What is FastAPI?', 'Installing FastAPI and Uvicorn', 'First Endpoint', 'Interactive Docs']],
        ['Path & Query Parameters', ['Path Parameters', 'Query Parameters', 'Type Hints', 'Validation with Pydantic']],
        ['Request Bodies', ['Pydantic Models', 'Nested Models', 'Response Models', 'Status Codes']],
      ]],
      ['Week 2', [
        ['Databases', ['SQLAlchemy Setup', 'CRUD Operations', 'Dependency Injection', 'Database Exercises']],
        ['Security', ['OAuth2 Password Flow', 'JWT Tokens', 'Protected Routes', 'CORS']],
      ]],
    ]],
  ],
  C07: [
    ['GenAI Foundations', [
      ['Week 1', [
        ['Introduction to GenAI', ['What is Generative AI?', 'LLMs Explained', 'Tokens and Context Windows', 'Use Cases']],
        ['Prompt Engineering', ['Prompt Structure', 'Few-shot Prompting', 'Chain of Thought', 'Prompt Exercises']],
        ['Working with APIs', ['API Keys and SDKs', 'Chat Completions', 'Streaming Responses', 'Cost and Rate Limits']],
      ]],
      ['Week 2', [
        ['Embeddings & RAG', ['What are Embeddings?', 'Vector Databases', 'Chunking Strategies', 'Building a RAG Pipeline']],
        ['Evaluation & Safety', ['Evaluating Outputs', 'Hallucinations', 'Guardrails', 'Responsible AI']],
      ]],
    ]],
  ],
  C08: [
    ['LangGraph Essentials', [
      ['Week 1', [
        ['Agents Overview', ['What is an Agent?', 'Why Graphs for Agents', 'LangGraph Installation', 'First Graph']],
        ['State & Nodes', ['Graph State', 'Nodes and Edges', 'Conditional Edges', 'State Exercises']],
        ['Tools', ['Tool Calling', 'ToolNode', 'Custom Tools', 'Tool Exercises']],
      ]],
      ['Week 2', [
        ['Memory & Persistence', ['Checkpointers', 'Threads', 'Long-term Memory', 'Human-in-the-loop']],
        ['Multi-agent Systems', ['Supervisor Pattern', 'Subgraphs', 'Handoffs', 'Capstone Planning']],
      ]],
    ]],
  ],
};

export function buildModules(courseId: string, defs: ModDef[], source: 'seed' | 'pdf' | 'excel' | 'manual' = 'seed'): Module[] {
  let t = 0;
  return defs.map((m, mi) => ({
    id: `${courseId}-m${mi + 1}`,
    title: m[0],
    weeks: m[1].map((w, wi) => ({
      id: `${courseId}-m${mi + 1}w${wi + 1}`,
      title: w[0],
      days: w[1].map((d, di) => ({
        id: `${courseId}-m${mi + 1}w${wi + 1}d${di + 1}`,
        title: d[0],
        topics: d[1].map((title) => {
          t += 1;
          return { id: `${courseId}-t${t}`, key: `${courseId}-t${t}`, title, source };
        }),
      })),
    })),
  }));
}

import NOL_JSON from './pythonFoundationsNol.json';
import type { NotesOfLesson } from '../types';

/** Python Foundations: the syllabus is generated from the institute's Notes of Lesson PDF (25 days, 5 class days a week). */
export const PF_NOL_ID = 'NOL-C01-1';
export function buildPythonFoundations(createdAt: string): { version: SyllabusVersion; nol: NotesOfLesson } {
  const days = NOL_JSON.days;
  const weeks: Module['weeks'] = [];
  let t = 0;
  const nolDays: NotesOfLesson['days'] = [];
  days.forEach((d, i) => {
    const w = Math.floor(i / 5);
    if (!weeks[w]) weeks[w] = { id: `C01-m1w${w + 1}`, title: `Week ${w + 1}`, days: [] };
    const dayId = `C01-m1w${w + 1}d${(i % 5) + 1}`;
    weeks[w].days.push({ id: dayId, title: d.title, topics: d.topics.map((title) => { t += 1; return { id: `C01-t${t}`, key: `C01-t${t}`, title, source: 'pdf' as const }; }) });
    const content = { title: d.title, topics: [...d.topics], objectives: [...d.objectives], tasks: [...d.tasks] };
    nolDays.push({ id: `${PF_NOL_ID}-d${d.dayNumber}`, dayNumber: d.dayNumber, ...content, original: content, warnings: d.warnings, page: d.page, syllabusDayId: dayId });
  });
  const version: SyllabusVersion = { id: 'C01-v1', courseId: 'C01', version: 1, status: 'Published', createdAt, publishedAt: createdAt, changeNote: 'Generated from Python Foundations Notes of Lesson v1 (PDF)', modules: [{ id: 'C01-m1', title: 'Python Foundations', weeks }] };
  const nol: NotesOfLesson = {
    id: PF_NOL_ID, courseId: 'C01', version: 1, title: 'Python Foundations – Notes of Lesson', duration: NOL_JSON.duration, status: 'Published', sourceKind: 'pdf', sourceFileId: 'F-PF-1',
    days: nolDays, warnings: NOL_JSON.warnings, syllabusVersionId: 'C01-v1', createdAt, createdBy: 'Lakshmi Narayanan', publishedAt: createdAt, publishedBy: 'Lakshmi Narayanan',
    history: [{ at: createdAt, by: 'Lakshmi Narayanan', action: 'Uploaded Python_Foundations_Notes_of_Lesson.pdf and extracted 25 days' }, { at: createdAt, by: 'Lakshmi Narayanan', action: 'Published v1 and generated syllabus v1' }],
  };
  return { version, nol };
}

export function seedSyllabi(createdAt: string): SyllabusVersion[] {
  const list: SyllabusVersion[] = Object.entries(SYLLABUS_DEFS).map(([courseId, defs]) => ({
    id: `${courseId}-v1`,
    courseId,
    version: 1,
    status: 'Published',
    createdAt,
    publishedAt: createdAt,
    changeNote: 'Initial syllabus import',
    modules: buildModules(courseId, defs),
  }));
  list.unshift(buildPythonFoundations(createdAt).version);
  // JavaScript v2 draft — awaiting review (adds a topic and a new module)
  const js = list.find((s) => s.courseId === 'C04')!;
  const draft: SyllabusVersion = JSON.parse(JSON.stringify(js));
  draft.id = 'C04-v2';
  draft.version = 2;
  draft.status = 'Draft';
  draft.publishedAt = undefined;
  draft.changeNote = 'Adds "Optional Chaining" topic and a new Modules & Tooling module';
  draft.modules[0].weeks[1].days[0].topics.push({ id: 'C04-t900', key: 'C04-t900', title: 'Optional Chaining', source: 'manual' });
  draft.modules.push({
    id: 'C04-m3', title: 'Modules & Tooling', weeks: [{ id: 'C04-m3w1', title: 'Week 4', days: [
      { id: 'C04-m3w1d1', title: 'ES Modules', topics: [
        { id: 'C04-t901', key: 'C04-t901', title: 'import and export', source: 'manual' },
        { id: 'C04-t902', key: 'C04-t902', title: 'Default vs Named Exports', source: 'manual' },
        { id: 'C04-t903', key: 'C04-t903', title: 'npm Basics', source: 'manual' },
      ] },
    ] }],
  });
  list.push(draft);
  return list;
}

export const MOCK_EXCEL_HEADERS = ['Module Name', 'Week No', 'Lesson / Day', 'Topic Title', 'Est. Minutes', 'Remarks'];
export const MOCK_EXCEL_ROWS: string[][] = [
  ['Pandas for Analysis', 'Week 1', 'Pandas Basics', 'Series and DataFrames', '40', ''],
  ['Pandas for Analysis', 'Week 1', 'Pandas Basics', 'Reading CSV and Excel', '30', ''],
  ['Pandas for Analysis', 'Week 1', 'Pandas Basics', 'Selecting Rows and Columns', '40', ''],
  ['Pandas for Analysis', 'Week 1', 'Pandas Basics', 'Selecting Rows and Columns', '40', 'duplicate row in source'],
  ['Pandas for Analysis', 'Week 1', 'Cleaning Data', 'Handling Missing Values', '45', ''],
  ['Pandas for Analysis', 'Week 1', 'Cleaning Data', '', '20', 'title missing'],
  ['Pandas for Analysis', 'Week 1', 'Cleaning Data', 'Data Type Fixes', '25', ''],
  ['Pandas for Analysis', 'Week 2', 'Grouping', 'groupby Basics', '40', ''],
  ['Pandas for Analysis', 'Week 2', 'Grouping', 'Pivot Tables', '35', ''],
  ['Pandas for Analysis', '', 'Grouping', 'Merging DataFrames', '45', 'week missing'],
  ['Visualization', 'Week 2', 'Charts', 'Matplotlib Basics', '40', ''],
  ['Visualization', 'Week 2', 'Charts', 'Seaborn Plots', '40', ''],
];
