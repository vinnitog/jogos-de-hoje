const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

const upstreams = [
  {
    repository: "goul4rt/lgpd-skills",
    commit: "d85d79abeeb37cb99fc0785e735a9ca790698a77",
    skills: [
      ".agents/skills/lgpd-audit/SKILL.md",
      ".agents/skills/lgpd-data-mapping/SKILL.md",
      ".agents/skills/lgpd-legacy-retrofit/SKILL.md"
    ],
    licenses: ["licenses/LGPD-SKILLS-MIT.txt"]
  },
  {
    repository: "pbakaus/impeccable",
    commit: "56f44523f76efdcec813e67b38ee550e49b16f48",
    skills: [".agents/skills/impeccable/SKILL.md"],
    licenses: [
      "licenses/IMPECCABLE-APACHE-2.0.txt",
      "licenses/IMPECCABLE-NOTICE.md"
    ]
  },
  {
    repository: "phuryn/pm-skills",
    commit: "18468a95b427e70e258b51389796367c6f684e7d",
    skills: [".agents/skills/monetization-strategy/SKILL.md"],
    licenses: ["licenses/PM-SKILLS-MIT.txt"]
  }
];

test("vendored skills have pinned sources and preserved licenses", () => {
  const notices = read("THIRD_PARTY_NOTICES.md");

  for (const upstream of upstreams) {
    assert.match(notices, new RegExp(upstream.repository.replace("/", "\\/")));
    assert.match(notices, new RegExp(`\\b${upstream.commit}\\b`));
    for (const file of [...upstream.skills, ...upstream.licenses]) {
      assert.ok(exists(file), `${file} should exist`);
    }
  }

  assert.match(read("licenses/LGPD-SKILLS-MIT.txt"), /Permission is hereby granted/);
  assert.match(read("licenses/PM-SKILLS-MIT.txt"), /Permission is hereby granted/);
  assert.match(read("licenses/IMPECCABLE-APACHE-2.0.txt"), /Apache License[\s\S]*Version 2\.0/);
  assert.match(read("licenses/IMPECCABLE-NOTICE.md"), /Third-Party Notices/);
});

test("project profile adapts all three skill families to this PWA", () => {
  const profile = read("PROJECT_SKILLS.md");

  assert.match(profile, /## LGPD/);
  assert.match(profile, /lgpd-audit/);
  assert.match(profile, /sem cadastro, banco, analytics, anúncios, cookies ou coleta de contato/i);
  assert.match(profile, /## Impeccable/);
  assert.match(profile, /modo `polish`/);
  assert.match(profile, /mobile-first/);
  assert.match(profile, /## Monetização e precificação/);
  assert.match(profile, /monetization-strategy/);
  assert.match(profile, /docs\/MONETIZATION\.md/);
});

test("LGPD audit artifacts and monetization output remain versionable", () => {
  for (const file of [
    ".lgpd/STATUS.md",
    ".lgpd/discovery.md",
    ".lgpd/data-map.md",
    ".lgpd/gaps.md",
    "docs/MONETIZATION.md"
  ]) {
    assert.ok(exists(file), `${file} should exist`);
    assert.ok(read(file).trim().length > 100, `${file} should not be an empty placeholder`);
  }

  assert.match(read(".lgpd/STATUS.md"), /Cenário.*B.*retrofit/i);
  assert.match(read(".lgpd/data-map.md"), /Dados pessoais armazenados pelo app[^\n]*Nenhum/i);
  assert.match(read("docs/MONETIZATION.md"), /hipóteses para validação, não preços lançados/i);
});

test("README local links resolve inside the repository", () => {
  const readme = read("README.md");
  const links = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().replace(/^<|>$/g, ""))
    .filter((href) => !/^(?:https?:|mailto:|#)/i.test(href));

  assert.ok(links.length > 0, "README should link to its project documentation");
  for (const href of links) {
    const pathname = decodeURIComponent(href.split(/[?#]/, 1)[0]);
    const target = path.resolve(root, pathname);
    const relative = path.relative(root, target);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `${href} must stay inside the repository`);
    assert.ok(fs.existsSync(target), `${href} should resolve to an existing file or directory`);
  }
});

test("portfolio-facing first-party files expose no local paths or secret material", () => {
  const files = [
    "README.md",
    "PROJECT_CONTEXT.md",
    "PROJECT_SKILLS.md",
    "THIRD_PARTY_NOTICES.md",
    "docs/MONETIZATION.md",
    ".lgpd/STATUS.md",
    ".lgpd/discovery.md",
    ".lgpd/data-map.md",
    ".lgpd/gaps.md",
    "index.html",
    "js/app.js",
    "sw.js"
  ];
  const forbidden = [
    /[A-Za-z]:\\Users\\/,
    /\/(?:Users|home)\/[^/\s]+\//,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*["'][^"']{8,}["']/i
  ];

  for (const file of files) {
    const content = read(file);
    for (const pattern of forbidden) {
      assert.doesNotMatch(content, pattern, `${file} should not expose ${pattern}`);
    }
  }
});
