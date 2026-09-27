export interface ClassTeacherAssignment {
  section: '10-A' | '10-B' | '10-C' | '10-D' | '10-E';
  teacherName: string; // e.g. 'Nethic Sir', 'Not Assigned'
  updatedAt?: string;
}

const CLASS_TEACHERS_KEY = 'stba_class10_teachers_v5';
export const CLASS_TEACHER_EVENT = 'stba_class_teachers_updated';

// Only Nethic Sir is the designated Class Teacher for 10-D.
// Seema Ma'am and Jitendra Singh Sir are NOT class teachers.
export const INITIAL_CLASS_TEACHERS: Record<string, string> = {
  '10-A': 'Not Assigned',
  '10-B': 'Not Assigned',
  '10-C': 'Not Assigned',
  '10-D': 'Nethic Sir',
  '10-E': 'Not Assigned',
};

export function normalizeTeacherName(name: string): string {
  const lower = name.toLowerCase().replace(/^(mr\.|mrs\.|ms\.|dr\.)\s*/, '').trim();
  if (lower.includes('natik') || lower.includes('nethi')) return 'nethic';
  if (lower.includes('chitra')) return 'chitra';
  if (lower.includes('krishna')) return 'krishna';
  if (lower.includes('shyam') || lower.includes('sawar') || lower.includes('sanwar')) return 'shyamlal';
  if (lower.includes('bhumi') || lower.includes('bhuvnesh') || lower.includes('bhupesh') || lower.includes('bhumesh') || lower.includes('bhungesh')) return 'bhuvnesh';
  if (lower.includes('jitendra')) return 'jitendra';
  if (lower.includes('seema')) return 'seema';
  return lower;
}

/**
 * Checks whether a teacher is an official Class Teacher, and returns their assigned section.
 * Enforces rule: Only Nethic Sir is 10-D Class Teacher.
 * Seema Ma'am and Jitendra Singh Sir are NEVER class teachers.
 */
export function checkIsClassTeacher(teacherName: string): { isClassTeacher: boolean; section?: string } {
  const norm = normalizeTeacherName(teacherName);
  if (norm === 'seema' || norm === 'jitendra') {
    return { isClassTeacher: false };
  }
  const map = getClass10Teachers();
  for (const [sec, assignedTeacher] of Object.entries(map)) {
    if (assignedTeacher && assignedTeacher !== 'Not Assigned') {
      if (normalizeTeacherName(assignedTeacher) === norm) {
        return { isClassTeacher: true, section: sec };
      }
    }
  }
  return { isClassTeacher: false };
}

export function getClass10Teachers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLASS_TEACHERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        // Enforce strict rule: Seema Ma'am and Jitendra Singh Sir are never class teachers
        const sanitized: Record<string, string> = {
          '10-A': parsed['10-A'] || INITIAL_CLASS_TEACHERS['10-A'],
          '10-B': parsed['10-B'] || INITIAL_CLASS_TEACHERS['10-B'],
          '10-C': parsed['10-C'] || INITIAL_CLASS_TEACHERS['10-C'],
          '10-D': parsed['10-D'] || INITIAL_CLASS_TEACHERS['10-D'],
          '10-E': parsed['10-E'] || INITIAL_CLASS_TEACHERS['10-E'],
        };
        // Verify 10-D is Nethic Sir and others are not Seema/Jitendra
        ['10-A', '10-B', '10-C', '10-D', '10-E'].forEach(sec => {
          const norm = normalizeTeacherName(sanitized[sec] || '');
          if (norm === 'seema' || norm === 'jitendra') {
            sanitized[sec] = 'Not Assigned';
          }
        });
        if (!sanitized['10-D'] || sanitized['10-D'] === 'Not Assigned') {
          sanitized['10-D'] = 'Nethic Sir';
        }
        return sanitized;
      }
    }
  } catch (e) {
    console.error('Failed to parse class teacher assignments from storage', e);
  }

  // Save initial
  try {
    localStorage.setItem(CLASS_TEACHERS_KEY, JSON.stringify(INITIAL_CLASS_TEACHERS));
  } catch (e) {
    console.error('Failed to seed class teacher assignments', e);
  }

  return { ...INITIAL_CLASS_TEACHERS };
}

export function setClass10Teacher(section: string, teacherName: string): Record<string, string> {
  const current = getClass10Teachers();
  const trimmed = teacherName.trim();
  const norm = normalizeTeacherName(trimmed);
  // Guard: Seema Ma'am and Jitendra Singh Sir are NOT allowed to be class teachers
  if (norm === 'seema' || norm === 'jitendra') {
    return current;
  }
  current[section] = trimmed || 'Not Assigned';
  try {
    localStorage.setItem(CLASS_TEACHERS_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent(CLASS_TEACHER_EVENT, { detail: current }));
  } catch (e) {
    console.error('Failed to persist class teacher assignment', e);
  }
  return current;
}

export function removeClass10Teacher(section: string): Record<string, string> {
  return setClass10Teacher(section, 'Not Assigned');
}

/**
 * Returns the sections a specific teacher is assigned to (either as Class Teacher or Subject Teacher).
 * Strictly restricts to Class 10 (10-A to 10-E).
 */
export function getAssignedClassesForTeacher(teacherName: string, subjectClasses: string[] = []): string[] {
  const map = getClass10Teachers();
  const assigned = new Set<string>();
  const normTeacher = normalizeTeacherName(teacherName);

  // Special authoritative assignments per user specifications:
  // Seema Ma'am: Information Technology (IT) - Teaches ALL 5 classes
  if (normTeacher === 'seema') {
    return ['10-A', '10-B', '10-C', '10-D', '10-E'];
  }

  // Jitendra Singh Sir: Mathematics - Teaches EXACTLY 10-A, 10-B, 10-C
  if (normTeacher === 'jitendra') {
    return ['10-A', '10-B', '10-C'];
  }

  // Nethic Sir: Science - Class Teacher 10-D
  if (normTeacher === 'nethic') {
    return ['10-D'];
  }

  // Bhuvnesh Sir: Mathematics - Teaches 10-D, 10-E
  if (normTeacher === 'bhuvnesh') {
    return ['10-D', '10-E'];
  }

  // Add any section where this teacher is the official Class Teacher (only for non-Seema, non-Jitendra)
  Object.entries(map).forEach(([sec, name]) => {
    if (name && name !== 'Not Assigned') {
      const normMapped = normalizeTeacherName(name);
      if (normMapped === normTeacher || name.trim().toLowerCase() === teacherName.trim().toLowerCase()) {
        assigned.add(sec);
      }
    }
  });

  // Add any subject classes that are valid Class 10 sections
  subjectClasses.forEach((cls) => {
    const raw = String(cls).trim().toUpperCase();
    let formatted = '';
    if (raw.includes('10-')) {
      formatted = raw.match(/10-[A-E]/)?.[0] || '';
    } else if (raw.includes('10')) {
      const secLetter = raw.replace(/[^A-E]/g, '');
      if (secLetter) formatted = `10-${secLetter[0]}`;
    }
    if (['10-A', '10-B', '10-C', '10-D', '10-E'].includes(formatted)) {
      assigned.add(formatted);
    }
  });

  if (assigned.size === 0) {
    assigned.add('10-A');
  }

  return Array.from(assigned).sort();
}
