import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './StatTooltip.css';

// ─── Stat glossary ────────────────────────────────────────────────────────────

export interface GlossaryEntry {
  name: string;
  desc: string;
  context?: string;
}

export const STAT_GLOSSARY: Record<string, GlossaryEntry> = {
  // ── Batting slash line ──────────────────────────────────────────────
  'AVG': {
    name: 'Batting Average',
    desc: 'Hits divided by at-bats. The most traditional measure of a hitter\'s ability to make contact.',
    context: 'League avg ≈ .250 · Elite ≥ .300',
  },
  'OBP': {
    name: 'On-Base Percentage',
    desc: 'How often a batter reaches base, counting hits, walks, and hit-by-pitches. A better measure of offensive value than AVG alone.',
    context: 'League avg ≈ .320 · Elite ≥ .380',
  },
  'SLG': {
    name: 'Slugging Percentage',
    desc: 'Total bases divided by at-bats. Measures raw power by weighting extra-base hits (2B = 2, 3B = 3, HR = 4).',
    context: 'League avg ≈ .415 · Elite ≥ .500',
  },
  'OPS': {
    name: 'On-Base Plus Slugging',
    desc: 'OBP + SLG combined into one number. A quick all-around offensive indicator, though it slightly undervalues OBP.',
    context: 'League avg ≈ .735 · Elite ≥ .900',
  },
  'ISO': {
    name: 'Isolated Power',
    desc: 'SLG minus AVG — measures pure extra-base hit power by removing singles from the equation.',
    context: 'League avg ≈ .165 · Elite ≥ .250',
  },
  'BABIP': {
    name: 'Batting Avg on Balls in Play',
    desc: 'AVG on balls put in play (excluding HRs and strikeouts). Useful for spotting luck — very high or low BABIP often regresses toward the mean.',
    context: 'League avg ≈ .300 · Outliers suggest luck',
  },

  // ── Advanced hitting ────────────────────────────────────────────────
  'wOBA': {
    name: 'Weighted On-Base Average',
    desc: 'A single rate stat that weights each way of reaching base by its actual run value. More accurate than OPS at measuring offensive contribution.',
    context: 'League avg ≈ .320 · Elite ≥ .400',
  },
  'wRC+': {
    name: 'Weighted Runs Created Plus',
    desc: 'Measures total offensive value adjusted for park and era, scaled so 100 = league average. A 130 wRC+ means 30% better than average.',
    context: '100 = League avg · Elite ≥ 140',
  },
  'xwOBA': {
    name: 'Expected wOBA (Statcast)',
    desc: 'Expected wOBA based on exit velocity and launch angle — strips out defense and luck. Compare to actual wOBA to spot over/under-performers.',
    context: 'Same scale as wOBA · ~.320 = avg',
  },

  // ── Contact quality ─────────────────────────────────────────────────
  'Exit Velo': {
    name: 'Average Exit Velocity',
    desc: 'Average speed of the ball off the bat (mph). Higher exit velocity correlates strongly with offensive success and hard contact.',
    context: 'League avg ≈ 88.5 mph · Elite ≥ 92 mph',
  },
  'Barrel %': {
    name: 'Barrel Rate',
    desc: 'Percentage of batted balls classified as "barreled" — exit velocity ≥ 98 mph at ideal launch angles. Barreled balls have a .500+ AVG and 1.500+ SLG.',
    context: 'League avg ≈ 7.5% · Elite ≥ 15%',
  },
  'Hard Hit %': {
    name: 'Hard Hit Rate',
    desc: 'Percentage of batted balls with exit velocity ≥ 95 mph. Measures consistent hard contact regardless of angle.',
    context: 'League avg ≈ 37% · Elite ≥ 48%',
  },
  'Sweet Spot%': {
    name: 'Sweet Spot Rate',
    desc: 'Percentage of batted balls hit at a launch angle between 8° and 32° — the optimal zone for line drives and home runs.',
    context: 'League avg ≈ 32% · Higher is better',
  },

  // ── Plate discipline ────────────────────────────────────────────────
  'BB%': {
    name: 'Walk Rate',
    desc: 'Percentage of plate appearances ending in a walk. Indicates patience and pitch recognition. For pitchers, lower is better.',
    context: 'Hitter avg ≈ 8.5% · Pitcher avg ≈ 8%',
  },
  'K%': {
    name: 'Strikeout Rate',
    desc: 'Percentage of plate appearances ending in a strikeout. For hitters, lower is better. For pitchers, higher is better.',
    context: 'League avg ≈ 22% for both',
  },

  // ── Batted ball profile ─────────────────────────────────────────────
  'GB%': {
    name: 'Ground Ball Rate',
    desc: 'Percentage of batted balls that are ground balls. Higher GB% for pitchers means fewer home runs allowed. For hitters, depends on speed and power profile.',
    context: 'League avg ≈ 44% (pitchers)',
  },
  'FB%': {
    name: 'Fly Ball Rate',
    desc: 'Percentage of batted balls that are fly balls. High fly ball rate for hitters correlates with more home run potential.',
    context: 'League avg ≈ 35% (pitchers)',
  },
  'LD%': {
    name: 'Line Drive Rate',
    desc: 'Percentage of batted balls classified as line drives. Line drives have the highest BABIP of any batted ball type (~.680).',
    context: 'League avg ≈ 21% · Higher is better',
  },
  'Pull%': {
    name: 'Pull Rate',
    desc: 'Percentage of batted balls hit to the pull side. High pull rates often indicate power-oriented hitters who can be exploited on the outer half.',
    context: 'League avg ≈ 38%',
  },
  'Center%': {
    name: 'Center Rate',
    desc: 'Percentage of batted balls hit up the middle. Hitting to all fields is generally a sign of better plate coverage.',
    context: 'League avg ≈ 32%',
  },
  'Oppo%': {
    name: 'Opposite Field Rate',
    desc: 'Percentage of batted balls hit to the opposite field. Higher oppo rates suggest a patient hitter who uses the whole field.',
    context: 'League avg ≈ 26%',
  },

  // ── Pitching core ───────────────────────────────────────────────────
  'ERA': {
    name: 'Earned Run Average',
    desc: 'Earned runs allowed per 9 innings. The standard measure of pitching effectiveness, though it can be influenced by defense and luck.',
    context: 'League avg ≈ 4.20 · Elite ≤ 3.00',
  },
  'xERA': {
    name: 'Expected ERA (Statcast)',
    desc: 'ERA estimator based on strikeouts, walks, hit-by-pitches, and home runs — the so-called "SIERA" components. Removes defense and BABIP luck.',
    context: 'Same scale as ERA · predicts future ERA',
  },
  'WHIP': {
    name: 'Walks + Hits per Inning',
    desc: 'Total walks and hits allowed per inning pitched. Measures how many baserunners a pitcher allows, regardless of whether they score.',
    context: 'League avg ≈ 1.30 · Elite ≤ 1.05',
  },
  'K/9': {
    name: 'Strikeouts per 9 Innings',
    desc: 'Strikeouts scaled to a 9-inning rate. Measures swing-and-miss ability independent of how many innings the pitcher works.',
    context: 'League avg ≈ 8.5 · Elite ≥ 11',
  },
  'BB/9': {
    name: 'Walks per 9 Innings',
    desc: 'Walks allowed scaled to a 9-inning rate. Lower is better — high walk rates lead to more traffic on the bases.',
    context: 'League avg ≈ 3.2 · Elite ≤ 2.0',
  },
  'HR/9': {
    name: 'Home Runs per 9 Innings',
    desc: 'Home runs allowed scaled to a 9-inning rate. Largely influenced by fly ball rate and park factors.',
    context: 'League avg ≈ 1.20 · Elite ≤ 0.80',
  },
  'K-BB%': {
    name: 'Strikeout Minus Walk Rate',
    desc: 'K% minus BB% — a single number combining the two most pitcher-controlled outcomes. The best single-stat measure of pitching command and stuff.',
    context: 'League avg ≈ 13–14% · Elite ≥ 20%',
  },
  'FIP': {
    name: 'Fielding Independent Pitching',
    desc: 'ERA estimator using only K, BB, HBP, and HR — the outcomes the pitcher most controls. Removes team defense from the equation.',
    context: 'Same scale as ERA · avg ≈ 4.20',
  },
  'Avg FB': {
    name: 'Average Fastball Velocity',
    desc: 'Average velocity of the pitcher\'s primary fastball (four-seam or sinker). Higher velocity correlates with more swing-and-miss.',
    context: 'League avg ≈ 93–94 mph · Elite ≥ 97 mph',
  },
  'Whiff%': {
    name: 'Whiff Rate',
    desc: 'Percentage of individual pitches that result in a swing-and-miss. Measures a pitch\'s ability to deceive hitters beyond just strikeout rate.',
    context: 'League avg ≈ 24% · Elite ≥ 33%',
  },
  'Chase%': {
    name: 'Chase Rate',
    desc: 'Percentage of pitches outside the strike zone that batters swing at. Elite pitchers expand the zone and get hitters to chase bad pitches.',
    context: 'League avg ≈ 29% · Elite ≥ 34%',
  },

  // ── Defense ─────────────────────────────────────────────────────────
  'OAA': {
    name: 'Outs Above Average',
    desc: 'Statcast metric counting how many outs a fielder converts above or below average, based on the difficulty of each opportunity. Best modern defensive metric.',
    context: '0 = avg · +5 = Gold Glove caliber',
  },
  'DRS': {
    name: 'Defensive Runs Saved',
    desc: 'Estimates how many runs above or below average a fielder saves using video-based zone analysis. Older metric, still widely cited.',
    context: '0 = avg · ±5 = solid · ±10 = elite',
  },
  'UZR/150': {
    name: 'Ultimate Zone Rating per 150 Games',
    desc: 'UZR prorated to 150 games for equal comparison. Measures range, arm, errors, and double-play ability compared to positional average.',
    context: '0 = avg · +10 = elite · −10 = poor',
  },
  'Defense': {
    name: 'FanGraphs Defensive Value',
    desc: 'FanGraphs composite defensive metric combining UZR and positional adjustment. Represents runs saved above or below average per season.',
    context: '0 = avg · ±10 = significant defender',
  },
  'FLD%': {
    name: 'Fielding Percentage',
    desc: 'Percentage of defensive chances handled without an error: (PO + A) / (PO + A + E). Traditional fielding stat — doesn\'t capture range.',
    context: 'Most positions ≥ .980 is excellent',
  },
  'Framing': {
    name: 'Catcher Framing Runs',
    desc: 'Runs saved by a catcher\'s ability to present pitches as strikes to umpires. Among the most impactful catcher skills in modern analytics.',
    context: '0 = avg · +10 per season = elite',
  },

  // ── WAR ─────────────────────────────────────────────────────────────
  'fWAR': {
    name: 'FanGraphs Wins Above Replacement',
    desc: 'Cumulative wins contributed above a replacement-level player. Combines offense, defense, baserunning, and position.',
    context: '2 = solid starter · 5 = All-Star · 8+ = MVP',
  },

  // ── Win probability & clutch ─────────────────────────────────────────
  'WPA': {
    name: 'Win Probability Added',
    desc: 'The total change in win probability a player has generated across all plate appearances. Each PA is worth more or less depending on game state — a walk-off homer adds far more than one in a blowout.',
    context: '+1.0 = elite · 0 = average · negative = below avg',
  },
  'RE24': {
    name: 'Run Expectancy (24 Base-Out States)',
    desc: 'Runs contributed above or below average based on the 24 base-out states. Measures how well a player changes the expected runs environment relative to what an average player would do.',
    context: '+10 = excellent · 0 = average · negative = below avg',
  },
  'Clutch': {
    name: 'Clutch Score (FanGraphs)',
    desc: 'Measures how much better or worse a player performs in high-leverage situations compared to their overall production. Positive means they\'ve outperformed their average in clutch spots.',
    context: '+1.0 = very clutch · 0 = neutral · negative = struggles in clutch',
  },

  // ── Advanced defense ─────────────────────────────────────────────────
  'UZR': {
    name: 'Ultimate Zone Rating',
    desc: 'Estimates the number of runs a fielder saves or costs compared to an average fielder at the same position, using zone-based analysis of where balls are hit and whether they\'re converted into outs.',
    context: '0 = avg · +5 = above avg · −5 = below avg · updated mid-season',
  },
  'ARM': {
    name: 'Outfield Arm Runs (FanGraphs)',
    desc: 'Estimates the runs saved or lost by an outfielder\'s throwing arm — based on how often runners advance or are thrown out compared to league average. Outfielders only; not applicable to infielders.',
    context: '0 = avg · positive = strong arm · negative = weak arm',
  },

  // ── Counting stats ──────────────────────────────────────────────────
  'G': {
    name: 'Games Played',
    desc: 'Total games the player has appeared in this season.',
    context: 'Context matters — SP: 30+ = full season; RP: 60+ = heavy workload',
  },
  'GS': {
    name: 'Games Started',
    desc: 'Games in which the pitcher was the starter (took the mound to begin the game).',
    context: 'Full season SP typically makes 30–33 starts',
  },
  'PA': {
    name: 'Plate Appearances',
    desc: 'Every trip to the plate, including walks, hit-by-pitches, and sacrifice flies. More complete than at-bats for sample size.',
    context: '502 PA = qualified for batting title',
  },
  'AB': {
    name: 'At-Bats',
    desc: 'Plate appearances minus walks, HBP, sacrifice flies, and sacrifice bunts. The denominator for batting average.',
    context: 'Differs from PA — AB excludes walks and sacs',
  },
  'H': {
    name: 'Hits',
    desc: 'Times the batter reached base safely via a single, double, triple, or home run (not walks/errors).',
    context: '200 hits in a season is the traditional elite threshold',
  },
  '1B': {
    name: 'Singles',
    desc: 'Hits where the batter reaches exactly first base. The most common hit type.',
    context: 'Singles hitters rely on speed and bat-to-ball contact',
  },
  '2B': {
    name: 'Doubles',
    desc: 'Hits where the batter reaches second base. Doubles correlate strongly with extra-base power.',
    context: '40+ doubles in a season is an excellent mark',
  },
  '3B': {
    name: 'Triples',
    desc: 'Hits where the batter reaches third base. The rarest hit type — requires both speed and a well-placed ball.',
    context: '10+ triples in a season is elite',
  },
  'HR': {
    name: 'Home Runs',
    desc: 'Balls hit over the fence in fair territory, scoring the batter and all base runners.',
    context: '30+ = strong power season · 40+ = elite',
  },
  'R': {
    name: 'Runs Scored',
    desc: 'Times the player crossed home plate to score a run. Partially dependent on teammates\' ability to drive them in.',
    context: 'Context-dependent: players on good offenses score more',
  },
  'RBI': {
    name: 'Runs Batted In',
    desc: 'Runs that scored because of the batter\'s plate appearance (hits, walks with bases loaded, etc.). Very context-dependent.',
    context: '100 RBI = traditional benchmark · heavily lineup-dependent',
  },
  'SB': {
    name: 'Stolen Bases',
    desc: 'Times a runner successfully advanced a base without the ball being hit. Success rate matters — below ~70% actually hurts run expectancy.',
    context: '30+ SB = elite speed · use with Caught Stealing',
  },
  'BB': {
    name: 'Walks (Bases on Balls)',
    desc: 'Times the batter reached first base on four balls. A walk is as good as a single for reaching base.',
    context: 'High walk totals indicate strong plate discipline',
  },
  'SO': {
    name: 'Strikeouts',
    desc: 'Times the batter was called out on three strikes. For hitters, lower is better — strikeouts remove the chance to put the ball in play.',
    context: 'Modern league avg ≈ 150 K/season per hitter',
  },
  'W': {
    name: 'Pitcher Wins',
    desc: 'Awarded to the pitcher of record when their team takes a lead that holds for the rest of the game. Heavily context/defense dependent.',
    context: 'Use FIP or WAR instead for true quality assessment',
  },
  'L': {
    name: 'Pitcher Losses',
    desc: 'Charged to the pitcher who allowed the opponent to take a permanent lead. Like wins, largely influenced by run support and team context.',
    context: 'A bad metric for evaluating pitchers independently',
  },
  'SV': {
    name: 'Saves',
    desc: 'Awarded to a reliever who finishes a win while protecting a lead of ≤3 runs, inherited lead, or entering with tying run on base/deck/at plate.',
    context: '30+ saves = elite closer season',
  },

  // ── Rate stats (additional) ──────────────────────────────────────────
  'BB/K': {
    name: 'Walk-to-Strikeout Ratio',
    desc: 'Walks divided by strikeouts. A simple measure of plate discipline — higher means the hitter walks more than they strike out, indicating excellent pitch recognition.',
    context: '≥ 0.50 = good discipline · ≥ 1.0 = elite',
  },
  'LOB%': {
    name: 'Left on Base Percentage',
    desc: 'Percentage of runners a pitcher strands — left on base without scoring. High LOB% can indicate luck or exceptional performance in clutch situations; it tends to regress toward ~72–73%.',
    context: '72–73% = average · ≥78% = lucky or truly elite',
  },
  'IFFB%': {
    name: 'Infield Fly Ball Rate',
    desc: 'Percentage of fly balls that are pop-ups to the infield. Infield pop-ups are essentially automatic outs — high IFFB% is great for pitchers, bad for hitters.',
    context: '≥12% for pitchers = pop-up machine (good)',
  },
  'HR/FB': {
    name: 'Home Run per Fly Ball Rate',
    desc: 'Percentage of fly balls that became home runs. Largely influenced by park factors and exit velocity. For pitchers, ≤7% is elite, ≥13% is concerning.',
    context: 'League avg ≈ 10–11% · park-adjusted versions preferred',
  },

  // ── Statcast expected stats ──────────────────────────────────────────
  'xBA': {
    name: 'Expected Batting Average',
    desc: 'Expected batting average based on the exit velocity and launch angle of every batted ball — ignoring defense and luck. A better measure of true contact quality than AVG.',
    context: 'Same scale as AVG · .260+ = above average',
  },
  'xSLG': {
    name: 'Expected Slugging Percentage',
    desc: 'Expected slugging based on Statcast contact quality. Accounts for the type and quality of contact rather than actual outcomes.',
    context: 'Same scale as SLG · .430+ = above average',
  },
  'xISO': {
    name: 'Expected Isolated Power',
    desc: 'Expected ISO calculated as xSLG − xBA. Measures raw power potential based on contact quality, stripped of luck and park effects.',
    context: 'Same scale as ISO · .170+ = above average',
  },
  'BA−xBA': {
    name: 'Batting Average vs Expected',
    desc: 'Actual BA minus Expected BA. Positive value = over-performing (getting lucky or beating defense); negative = under-performing (unlucky or facing good defense). Tends to regress toward zero.',
    context: 'Positive = currently lucky · Negative = due for improvement',
  },
  'SLG−xSLG': {
    name: 'Slugging vs Expected Slugging',
    desc: 'Actual SLG minus Expected SLG. A large positive difference often means the player has been getting lucky on batted balls (e.g. more extra-base hits than their contact quality warrants).',
    context: 'Positive = over-performing · Negative = under-performing',
  },
  'wOBA−xwOBA': {
    name: 'wOBA vs Expected wOBA',
    desc: 'Actual wOBA minus Expected wOBA (xwOBA). The single best indicator of batting luck — if wOBA greatly exceeds xwOBA, regression is likely. If xwOBA leads, a breakout may be coming.',
    context: 'Positive = currently over-performing · Negative = due to improve',
  },

  // ── Velocity (pitching) ──────────────────────────────────────────────
  'Avg Velo': {
    name: 'Average Pitch Velocity',
    desc: 'Average speed in mph across all pitch types. Higher velocity correlates with more swing-and-miss and less reaction time for hitters.',
    context: 'League avg ≈ 93–94 mph · Elite starters ≥ 96 mph',
  },
  'Max Velo': {
    name: 'Maximum Pitch Velocity',
    desc: 'Top recorded pitch velocity this season. The highest velocity fastball thrown, useful for tracking velocity spikes or drops.',
    context: '100+ mph = elite velocity ceiling',
  },

  // ── Launch angle ─────────────────────────────────────────────────────
  'Launch Angle': {
    name: 'Average Launch Angle',
    desc: 'Average vertical angle at which the ball leaves the bat (degrees). Negative = grounders, 10–25° = line drives and home runs, >30° = pop-ups.',
    context: '10–20° is the optimal range for extra-base hits',
  },

  // ── Sprint speed ─────────────────────────────────────────────────────
  'Sprint Speed': {
    name: 'Sprint Speed',
    desc: 'Statcast measure of a player\'s top running speed in ft/sec, calculated as the peak 1-second burst in their fastest 10% of competitive runs.',
    context: 'League avg ≈ 27 ft/s · Elite ≥ 29 ft/s',
  },

  // ── Defense (counting) ───────────────────────────────────────────────
  'Inn': {
    name: 'Innings (Defensive)',
    desc: 'Total innings played in the field this season. A full season at a position is roughly 1,350–1,440 innings.',
    context: 'Used to normalize defensive metrics per 150 games',
  },
  'E': {
    name: 'Errors',
    desc: 'Fielding mistakes where the official scorer determined a play should have been made but wasn\'t. Doesn\'t capture range or poor routes.',
    context: 'Low error counts are necessary but not sufficient for good defense',
  },
  'A': {
    name: 'Assists',
    desc: 'Times a fielder touched the ball before a putout was recorded. Pitchers get an assist on strikeouts. Catchers get assists on pickoffs.',
    context: 'Middle infielders typically lead in assists',
  },
  'PO': {
    name: 'Putouts',
    desc: 'Times a fielder directly recorded an out — catching a fly ball, tagging a runner, or receiving a throw. First basemen and catchers lead in putouts.',
    context: '1B and C typically lead all positions in putouts',
  },

  // ── Game log ────────────────────────────────────────────────────────
  'Season AVG': {
    name: 'Cumulative Season Batting Average',
    desc: 'Running batting average through this game — total hits divided by total at-bats for the season up to and including this date.',
    context: 'Tracks how the season average has moved over time',
  },
  'IP': {
    name: 'Innings Pitched',
    desc: 'Total innings pitched in this game. Recorded as whole innings and outs (e.g. 6.2 = 6 innings and 2 outs).',
    context: 'Quality Start = 6+ IP with ≤ 3 ER',
  },
  'PC': {
    name: 'Pitch Count',
    desc: 'Total number of pitches thrown in this appearance.',
    context: '100 pitches is a traditional starter threshold',
  },
  'Dec': {
    name: 'Decision',
    desc: 'Whether the pitcher received a Win (W), Loss (L), Save (S), or no decision (—) in this game.',
    context: 'Highlighted rows = Quality Starts',
  },
};

// ─── Portal tooltip ───────────────────────────────────────────────────────────

const TOOLTIP_WIDTH  = 248;
const TOOLTIP_GAP    =  10;  // px between trigger and tooltip
const SCREEN_PADDING =  10;  // min distance from viewport edge

interface TooltipPortalProps {
  entry: GlossaryEntry;
  anchorRect: DOMRect;
  position: 'top' | 'bottom';
}

function TooltipPortal({ entry, anchorRect, position }: TooltipPortalProps) {
  // Horizontal: centre on trigger, then clamp to viewport
  let left = anchorRect.left + anchorRect.width / 2 - TOOLTIP_WIDTH / 2;
  left = Math.max(SCREEN_PADDING, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - SCREEN_PADDING));

  // Vertical: above or below the trigger
  const top = position === 'bottom'
    ? anchorRect.bottom + TOOLTIP_GAP + window.scrollY
    : anchorRect.top    - TOOLTIP_GAP + window.scrollY;  // will subtract own height via CSS

  // Arrow: where the tip should point horizontally (relative to tooltip left)
  const arrowLeft = Math.max(16, Math.min(
    anchorRect.left + anchorRect.width / 2 - left,
    TOOLTIP_WIDTH - 16
  ));

  return createPortal(
    <div
      className={`stat-tt-portal stat-tt-portal--${position}`}
      style={{
        left,
        top,
        '--arrow-left': `${arrowLeft}px`,
      } as React.CSSProperties}
    >
      <span className="stat-tt-name">{entry.name}</span>
      <span className="stat-tt-desc">{entry.desc}</span>
      {entry.context && <span className="stat-tt-context">{entry.context}</span>}
    </div>,
    document.body
  );
}

// ─── StatTooltip component ────────────────────────────────────────────────────

interface StatTooltipProps {
  stat: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

const SHOW_DELAY_MS = 1000;

export function StatTooltip({ stat, children, position = 'top' }: StatTooltipProps) {
  const entry = STAT_GLOSSARY[stat];
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const wrapRef  = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (wrapRef.current) setAnchorRect(wrapRef.current.getBoundingClientRect());
    }, SHOW_DELAY_MS);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setAnchorRect(null);
  }, []);

  if (!entry) return <>{children}</>;

  return (
    <>
      <span
        ref={wrapRef}
        className="stat-tt-trigger"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {anchorRect && (
        <TooltipPortal entry={entry} anchorRect={anchorRect} position={position} />
      )}
    </>
  );
}

/** Wraps a label string in a tooltip if a glossary entry exists */
export function StatLabel({ label, className }: { label: string; className?: string }) {
  const entry = STAT_GLOSSARY[label];
  if (!entry) return <span className={className}>{label}</span>;
  return (
    <StatTooltip stat={label}>
      <span className={className}>{label}</span>
    </StatTooltip>
  );
}
