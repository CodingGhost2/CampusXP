export type QuizQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type TaskQuiz = {
  title: string;
  questions: QuizQuestion[];
};

function normalizeText(raw: string): string {
  return raw.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractCoreTopic(rawTitle: string): string {
  const cleaned = normalizeText(rawTitle)
    .replace(/^learning path\s*\d+\s*\/\s*\d+\s*:\s*/i, "")
    .replace(/^(extract|build|solve|create|take|review|summarize)\s+/i, "")
    .replace(/\b(main|key|concise|timed|mixed|quick|quiz|check)\b/gi, "")
    .replace(/\b(with|for|from|on)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "this topic";
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isCalculusTopic(text: string): boolean {
  return /\b(calculus|derivative|integral|limit|chain rule|product rule|implicit differentiation|related rates|series)\b/i.test(
    text,
  );
}

function buildQuestion(prompt: string, correct: string, distractors: string[], explanation: string): QuizQuestion {
  const rawOptions = [correct, ...distractors].slice(0, 4);
  const shift = Math.abs([...prompt].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % rawOptions.length;
  const options = rawOptions.map((_, idx) => rawOptions[(idx + shift) % rawOptions.length]);
  return {
    prompt,
    options,
    correctIndex: options.indexOf(correct),
    explanation,
  };
}

function buildDebuggingQuestion(topic: string, lower: string): QuizQuestion {
  const isImplementationTask = hasAny(lower, [/\b(implement|build|design|develop|create)\b/i]);
  const isFixTask = hasAny(lower, [/\b(debug|fix|error|bug|issue|broken|failure)\b/i]);

  if (isFixTask) {
    return buildQuestion(
      `When debugging "${topic}", what should you isolate first to avoid chasing symptoms?`,
      "The smallest reproducible failure case and the exact assumption it violates.",
      [
        "Only cosmetic inconsistencies in formatting or naming.",
        "Every subsystem at once without narrowing scope.",
        "A complete rewrite before root cause is identified.",
      ],
      "Root-cause isolation with a reproducible case is the fastest path to a stable fix.",
    );
  }

  if (isImplementationTask) {
    return buildQuestion(
      `In an implementation of "${topic}", what is the safest first milestone?`,
      "A minimal, correct baseline with tests that validate expected behavior.",
      [
        "Complex optimizations before correctness is verified.",
        "Skipping edge cases until after deployment.",
        "Merging incomplete logic to speed up integration.",
      ],
      "A correct baseline prevents hidden defects from compounding during later changes.",
    );
  }

  return buildQuestion(
    `What is the best way to detect conceptual mistakes early in "${topic}" work?`,
    "Validate outcomes against explicit assumptions and small representative examples.",
    [
      "Treat first-pass output as reliable without validation.",
      "Rely only on intuition when results look plausible.",
      "Postpone verification until final submission.",
    ],
    "Early validation catches misunderstandings before they spread across the solution.",
  );
}

function buildImplementationQuestion(topic: string): QuizQuestion {
  return buildQuestion(
    `Which implementation strategy is most reliable for "${topic}" under real constraints?`,
    "Define invariants, handle edge cases deliberately, and test incrementally.",
    [
      "Optimize for speed first and document assumptions later.",
      "Depend on one happy-path example as proof of correctness.",
      "Increase complexity quickly to cover all possibilities in one pass.",
    ],
    "Stable implementations come from explicit invariants plus incremental validation.",
  );
}

function buildRiskQuestion(topic: string, lower: string): QuizQuestion {
  const isSecurityFocused = hasAny(lower, [/\b(security|vulnerability|threat|auth|privacy|attack)\b/i]);

  if (isSecurityFocused) {
    return buildQuestion(
      `For "${topic}", what failure is most dangerous if inputs are trusted by default?`,
      "Unvalidated input paths that allow injection, privilege abuse, or unsafe state changes.",
      [
        "Minor wording inconsistencies in user-facing labels.",
        "Slightly slower execution in non-critical paths.",
        "Using too many comments in implementation notes.",
      ],
      "Input trust boundaries must be explicit; validation and least privilege reduce exploitability.",
    );
  }

  return buildQuestion(
    `In practical "${topic}" use, which risk is most often underestimated?`,
    "Edge-case handling that silently violates assumptions or safety constraints.",
    [
      "Having too many documented decisions.",
      "Running small validation checks during development.",
      "Separating implementation from review notes.",
    ],
    "Most real failures come from unhandled edge conditions, not the average case.",
  );
}

function buildCalculusQuestions(topic: string): QuizQuestion[] {
  return [
    buildQuestion(
      `When solving "${topic}" derivative questions, what should you do first?`,
      "Rewrite the expression cleanly and identify the derivative rule before computing.",
      [
        "Start simplifying random terms and choose a rule after differentiating.",
        "Skip rule selection and memorize common final answers.",
        "Differentiate mentally and only write the final line.",
      ],
      "Choosing the rule from a clean setup reduces chain-rule and sign errors.",
    ),
    buildQuestion(
      `For applied "${topic}" optimization problems, which setup is most reliable?`,
      "Define objective, constraints, and domain before taking derivatives.",
      [
        "Take the derivative immediately without defining what to optimize.",
        "Use second derivatives first, then derive the objective later.",
        "Ignore constraints because critical points alone determine the answer.",
      ],
      "A correct model comes before calculus operations; otherwise even correct derivatives solve the wrong problem.",
    ),
    buildQuestion(
      `In "${topic}", which mistake most often breaks correctness?`,
      "Dropping inner-function factors or sign changes during intermediate steps.",
      [
        "Writing brief notes beside key transformations.",
        "Checking units or domain restrictions at the end.",
        "Plotting a rough graph to sanity-check the result.",
      ],
      "Small derivative-step omissions are a common source of wrong final answers in calculus.",
    ),
  ];
}

export function buildQuizFromTaskTitle(taskTitle: string): TaskQuiz {
  const topic = extractCoreTopic(taskTitle);
  const lowerTopic = topic.toLowerCase();
  if (isCalculusTopic(lowerTopic)) {
    return {
      title: `Calculus check: ${topic}`,
      questions: buildCalculusQuestions(topic),
    };
  }

  return {
    title: `Applied check: ${topic}`,
    questions: [
      buildDebuggingQuestion(topic, lowerTopic),
      buildImplementationQuestion(topic),
      buildRiskQuestion(topic, lowerTopic),
    ],
  };
}
