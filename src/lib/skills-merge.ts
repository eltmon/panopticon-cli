import {
  existsSync,
  readdirSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
  mkdirSync,
  appendFileSync,
} from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { SKILLS_DIR } from './paths.js';

type ContentOrigin = 'git-tracked' | 'panopticon' | 'user-untracked';

function detectContentOrigin(path: string, repoPath: string): ContentOrigin {
  try {
    const stat = lstatSync(path);

    // Check if symlink pointing to panopticon
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(path);
      if (target.includes('.panopticon')) {
        return 'panopticon';
      }
    }

    // Check if git-tracked
    try {
      execSync(`git ls-files --error-unmatch "${path}" 2>/dev/null`, {
        cwd: repoPath,
        stdio: 'pipe',
      });
      return 'git-tracked';
    } catch {
      return 'user-untracked';
    }
  } catch {
    return 'user-untracked';
  }
}

export function mergeSkillsIntoWorkspace(workspacePath: string): {
  added: string[];
  skipped: string[];
} {
  const skillsTarget = join(workspacePath, '.claude', 'skills');
  const added: string[] = [];
  const skipped: string[] = [];

  // Ensure target directory exists
  mkdirSync(skillsTarget, { recursive: true });

  // Get existing skills in workspace
  const existingSkills = new Set<string>();
  if (existsSync(skillsTarget)) {
    for (const item of readdirSync(skillsTarget)) {
      existingSkills.add(item);
    }
  }

  // Get panopticon skills
  if (!existsSync(SKILLS_DIR)) return { added, skipped };

  const panopticonSkills = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const skill of panopticonSkills) {
    const targetPath = join(skillsTarget, skill);
    const sourcePath = join(SKILLS_DIR, skill);

    // Skip if exists and is git-tracked
    if (existingSkills.has(skill)) {
      const origin = detectContentOrigin(targetPath, workspacePath);
      if (origin === 'git-tracked') {
        skipped.push(`${skill} (git-tracked)`);
        continue;
      }
      if (origin === 'panopticon') {
        // Already ours, skip silently
        continue;
      }
    }

    // Create symlink
    try {
      symlinkSync(sourcePath, targetPath);
      added.push(skill);
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        // If exists but not symlink, skip
        skipped.push(`${skill} (exists)`);
      }
    }
  }

  // Update .gitignore if we added anything
  if (added.length > 0) {
    updateGitignore(skillsTarget, added);
  }

  return { added, skipped };
}

function updateGitignore(skillsDir: string, skills: string[]): void {
  const gitignorePath = join(skillsDir, '.gitignore');

  const content = `# Panopticon-managed symlinks (not committed)
${skills.join('\n')}
`;

  try {
    appendFileSync(gitignorePath, content);
  } catch {
    // Ignore errors writing .gitignore
  }
}
