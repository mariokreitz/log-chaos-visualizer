export function tokenizeQuery(query: string): { tokens: string[]; phrases: string[] } {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return { tokens: [], phrases: [] };

  const tokens: string[] = [];
  const phrases: string[] = [];

  const phraseRegex = /"([^"]*)"/g;
  let match: RegExpExecArray | null;
  let remainingQuery = trimmed;

  while ((match = phraseRegex.exec(trimmed)) !== null) {
    phrases.push(match[1].trim());
    remainingQuery = remainingQuery.replace(match[0], '');
  }

  const rawTokens = remainingQuery.split(/[\s\-_.,;:/\\|()[\]{}<>"']+/).filter((token) => token.length > 0);
  const stemmedTokens = rawTokens.map(stemWord);
  tokens.push(...stemmedTokens);

  return { tokens, phrases };
}

function stemWord(word: string): string {
  const suffixes = ['ing', 'ly', 'ed', 'ies', 'ied', 's', 'es'];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 1) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

export function calculateRelevance(searchText: string, tokens: string[], phrases: string[]): number {
  let score = 0;

  for (const phrase of phrases) {
    if (searchText.includes(phrase)) {
      score += 100;
    }
  }

  const lowerSearch = searchText.toLowerCase();

  for (const token of tokens) {
    let tokenScore = 0;

    const occurrences = (lowerSearch.match(new RegExp(token, 'g')) || []).length;
    tokenScore += occurrences * 10;

    if (new RegExp(`\\b${token}\\b`).test(lowerSearch)) {
      tokenScore += 20;
    }

    if (lowerSearch.startsWith(token)) {
      tokenScore += 15;
    }

    score += tokenScore;
  }

  return score;
}

function fuzzyMatch(text: string, query: string, maxDistance = 2): boolean {
  if (Math.abs(text.length - query.length) > maxDistance) return false;

  let distance = 0;
  const maxLen = Math.max(text.length, query.length);

  for (let i = 0; i < maxLen; i++) {
    if (text[i] !== query[i]) {
      distance++;
      if (distance > maxDistance) return false;
    }
  }

  return distance <= maxDistance;
}

export function matchesQuery(searchText: string, tokens: string[], phrases: string[]): boolean {
  const lowerSearch = searchText.toLowerCase();

  for (const phrase of phrases) {
    if (!lowerSearch.includes(phrase)) {
      return false;
    }
  }

  for (const token of tokens) {
    let found = false;

    if (lowerSearch.includes(token)) {
      found = true;
    } else {
      const words = lowerSearch.split(/[\s\-_.,;:/\\|()[\]{}<>"']+/);
      for (const word of words) {
        if (word.length >= 3 && fuzzyMatch(word, token, 1)) {
          found = true;
          break;
        }
      }
    }

    if (!found) {
      return false;
    }
  }

  return true;
}
