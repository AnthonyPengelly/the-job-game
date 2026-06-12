// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import type { TriviaItemConfig } from '@/engine/config';
import { makeGenerate } from './generate';
import { InsideKnowledgeComponent } from './component';

afterEach(cleanup);

function startClockIfGated() {
  const gate = screen.queryByTestId('mg-start-clock');
  if (gate) fireEvent.click(gate);
}


const dial: Difficulty = { level: 0 };

const TEST_ITEMS: TriviaItemConfig[] = [
  { question: 'What is a PIN?', answer: 'Personal Identification Number', tier: 'easy', options: ['Personal Identification Number', 'Private Node', 'Portable Input', 'Public ID'] },
  { question: 'What does CCTV stand for?', answer: 'Closed-Circuit Television', tier: 'easy', options: ['Closed-Circuit Television', 'Central Control TV', 'Camera Control Terminal', 'Circuit Camera TV'] },
  { question: 'What is a deadbolt?', answer: 'A type of lock', tier: 'easy', options: ['A type of lock', 'A type of alarm', 'A type of safe', 'A type of camera'] },
];

function makeParams(seed = 1) {
  return makeGenerate(TEST_ITEMS)(mulberry32(seed), dial);
}

function makeCommitted(withCharm = false) {
  return [
    {
      id: 'p1' as import('@/engine').PlayerId,
      name: 'Lucy',
      stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
      powerUps: withCharm ? { charm: true as const } : {},
    },
  ];
}

// ── Q&A display ───────────────────────────────────────────────────────────────

describe('InsideKnowledgeComponent — Q&A display', () => {
  it('renders the current question', () => {
    const params = makeParams(1);
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    expect(screen.getByTestId('ik-question')).toBeInTheDocument();
    expect(screen.getByTestId('ik-question').textContent).toBe(params.questions[0]!.question);
  });

  it('renders the GM-only answer', () => {
    const params = makeParams(1);
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    expect(screen.getByTestId('ik-answer-value').textContent).toBe(params.questions[0]!.answer);
  });
});

// ── Mark correct / wrong ──────────────────────────────────────────────────────

describe('InsideKnowledgeComponent — mark buttons', () => {
  it('mark correct advances to next question', () => {
    const params = makeParams(1);
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    const q0 = params.questions[0]!.question;
    fireEvent.click(screen.getByTestId('ik-mark-correct'));
    if (params.questions.length > 1) {
      expect(screen.getByTestId('ik-question').textContent).not.toBe(q0);
    } else {
      expect(screen.getByTestId('ik-complete')).toBeInTheDocument();
    }
  });

  it('mark wrong also advances to next question', () => {
    const params = makeParams(1);
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    const q0 = params.questions[0]!.question;
    fireEvent.click(screen.getByTestId('ik-mark-wrong'));
    if (params.questions.length > 1) {
      expect(screen.getByTestId('ik-question').textContent).not.toBe(q0);
    } else {
      expect(screen.getByTestId('ik-complete')).toBeInTheDocument();
    }
  });

  it('complete message shown after all questions answered', () => {
    const params = makeGenerate([TEST_ITEMS[0]!])(mulberry32(1), { level: -100 });
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    for (let i = 0; i < params.questions.length; i++) {
      fireEvent.click(screen.getByTestId('ik-mark-correct'));
    }
    expect(screen.getByTestId('ik-complete')).toBeInTheDocument();
  });
});

// ── Narrow It Down variant ────────────────────────────────────────────────────

describe('InsideKnowledgeComponent — Narrow It Down', () => {
  it('4-option grid not shown before boost fires', () => {
    const params = makeParams(1);
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    expect(screen.queryByTestId('ik-options')).not.toBeInTheDocument();
  });

  it('4-option grid shown after Narrow It Down boost', () => {
    const params = makeGenerate(TEST_ITEMS)(mulberry32(1), dial);
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    // narrowItDownBoost.lane = 'charm', so testid is boost-charm
    fireEvent.click(screen.getByTestId('boost-charm'));
    if (params.questions[0]?.options !== undefined) {
      expect(screen.getByTestId('ik-options')).toBeInTheDocument();
    }
  });

  it('correct option has the correct marker class', () => {
    const params = makeGenerate(TEST_ITEMS)(mulberry32(1), dial);
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    // narrowItDownBoost.lane = 'charm', so testid is boost-charm
    fireEvent.click(screen.getByTestId('boost-charm'));
    if (params.questions[0]?.options !== undefined) {
      const correctIdx = params.questions[0].options.indexOf(params.questions[0].answer);
      if (correctIdx >= 0) {
        const optEl = screen.getByTestId(`ik-option-${correctIdx}`);
        expect(optEl.classList.contains('ik-opt4--correct')).toBe(true);
      }
    }
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('InsideKnowledgeComponent — onResolve', () => {
  it('calls onResolve when Call Outcome clicked', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    startClockIfGated();
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledOnce();
  });
});

// ── Boost slot (no layout shift) ──────────────────────────────────────────────

describe('InsideKnowledgeComponent — boost slot', () => {
  it('mg-boost-slot always rendered', () => {
    const params = makeParams(1);
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted(false)}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    const slots = document.querySelectorAll('.mg-boost-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Progress bar ──────────────────────────────────────────────────────────────

describe('InsideKnowledgeComponent — progress bar', () => {
  it('progress bar rendered', () => {
    const params = makeParams(1);
    render(
      <InsideKnowledgeComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    startClockIfGated();
    expect(screen.getByTestId('ik-progress-bar')).toBeInTheDocument();
  });
});
