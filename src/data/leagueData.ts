import type { Team, Player, Position } from '../types'

// Converts an overall rank (or average rank) into standard fantasy draft
// "round.pick" notation, e.g. 51 -> "5.3" (5th round, 3rd pick),
// 24 -> "2.12" (2nd round, 12th pick), based on a 12-team snake draft.
function formatRoundPick(avgRank: number | null, teams = 12): string | null {
  if (avgRank === null) return null
  const roundNum = Math.ceil(avgRank / teams)
  const pickInRound = avgRank - (roundNum - 1) * teams
  const pickInt = Math.max(1, Math.min(teams, Math.round(pickInRound)))
  return `${roundNum}.${pickInt}`
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE']

function metricSort(
  arr: Player[],
  field: 'dynastyOverallRank' | 'redraftOverallRank' | 'projectedPoints',
  higherIsBetter: boolean
): Player[] {
  return [...arr].sort((a, b) => (higherIsBetter ? b[field] - a[field] : a[field] - b[field]))
}

function computeTotals(players: Player[]) {
  const realStarters = players.filter((p) => p.isStarter)

  const posGroup = (pos: Position | null, arr: Player[]) =>
    pos ? arr.filter((p) => p.position === pos) : arr

  const slotCounts: Record<Position, number> = {
    QB: posGroup('QB', realStarters).length,
    RB: posGroup('RB', realStarters).length,
    WR: posGroup('WR', realStarters).length,
    TE: posGroup('TE', realStarters).length,
  }

  const dynamicGroups = (
    pos: Position | null,
    field: 'dynastyOverallRank' | 'redraftOverallRank' | 'projectedPoints',
    higherIsBetter: boolean
  ): { starters: Player[]; plus1: Player[] } => {
    const positionsToCheck = pos ? [pos] : POSITIONS
    const starters: Player[] = []
    const plus1: Player[] = []
    for (const p of positionsToCheck) {
      const sorted = metricSort(posGroup(p, players), field, higherIsBetter)
      starters.push(...sorted.slice(0, slotCounts[p]))
      if (sorted.length > slotCounts[p]) plus1.push(sorted[slotCounts[p]])
    }
    return { starters, plus1 }
  }

  const totalsFor = (pos: Position | null) => {
    const groupRoster = posGroup(pos, players)

    const dynastyGroups = dynamicGroups(pos, 'dynastyOverallRank', false)
    const redraftGroups = dynamicGroups(pos, 'redraftOverallRank', false)
    const projectedGroups = dynamicGroups(pos, 'projectedPoints', true)

    const dynastyStartersAvgRank = average(dynastyGroups.starters.map((p) => p.dynastyOverallRank))
    const dynastyPlus1AvgRank = average(
      [...dynastyGroups.starters, ...dynastyGroups.plus1].map((p) => p.dynastyOverallRank)
    )
    const dynastyRosterAvgRank = average(groupRoster.map((p) => p.dynastyOverallRank))

    const redraftStartersAvgRank = average(redraftGroups.starters.map((p) => p.redraftOverallRank))
    const redraftPlus1AvgRank = average(
      [...redraftGroups.starters, ...redraftGroups.plus1].map((p) => p.redraftOverallRank)
    )
    const redraftRosterAvgRank = average(groupRoster.map((p) => p.redraftOverallRank))

    const projectedStartersAvg = average(projectedGroups.starters.map((p) => p.projectedPoints))
    const projectedPlus1Avg = average(
      [...projectedGroups.starters, ...projectedGroups.plus1].map((p) => p.projectedPoints)
    )
    const projectedRosterAvg = average(groupRoster.map((p) => p.projectedPoints))

    return {
      dynastyStartersAvgRank,
      dynastyStartersAvgRankDisplay: formatRoundPick(dynastyStartersAvgRank),
      dynastyRosterAvgRank,
      dynastyRosterAvgRankDisplay: formatRoundPick(dynastyRosterAvgRank),
      dynastyPlus1AvgRank,
      dynastyPlus1AvgRankDisplay: formatRoundPick(dynastyPlus1AvgRank),
      redraftStartersAvgRank,
      redraftStartersAvgRankDisplay: formatRoundPick(redraftStartersAvgRank),
      redraftRosterAvgRank,
      redraftRosterAvgRankDisplay: formatRoundPick(redraftRosterAvgRank),
      redraftPlus1AvgRank,
      redraftPlus1AvgRankDisplay: formatRoundPick(redraftPlus1AvgRank),
      projectedStarters: projectedStartersAvg,
      projectedRoster: projectedRosterAvg,
      projectedPlus1: projectedPlus1Avg,
    }
  }

  return {
    overall: totalsFor(null),
    QB: totalsFor('QB'),
    RB: totalsFor('RB'),
    WR: totalsFor('WR'),
    TE: totalsFor('TE'),
  }
}

function mkPlayer(
  id: string,
  name: string,
  position: Position,
  nflTeam: string,
  isStarter: boolean,
  dynastyValue: number,
  dynastyOverallRank: number,
  dynastyPositionRank: number | null,
  redraftValue: number,
  redraftOverallRank: number,
  redraftPositionRank: number | null,
  projectedPoints: number,
  projectedPositionRank: number | null,
  acquisitionType: 'Drafted' | 'Trade' | 'Waiver' | 'Other' | null,
): Player {
  return {
    id, name, position, nflTeam, isStarter,
    dynastyValue, dynastyOverallRank, dynastyPositionRank,
    redraftValue, redraftOverallRank, redraftPositionRank,
    projectedPoints, projectedPositionRank, acquisitionType,
  }
}

// ---------------------------------------------------------------------------
// Team 1 — ZakF (owner: ZakF)
// ---------------------------------------------------------------------------
const t1Players: Player[] = [
  mkPlayer('t1p1', 'Chris Rodriguez', 'RB', 'JAX', false, 514, 214, 48, 353, 141, 47, 134.0, 39, 'Waiver'),
  mkPlayer('t1p2', 'Jonathon Brooks', 'RB', 'CAR', false, 607, 121, 36, 362, 132, 42, 26.7, 76, 'Drafted'),
  mkPlayer('t1p3', 'Brock Bowers', 'TE', 'LV', true, 703, 25, 1, 474, 20, 2, 290.3, 2, 'Drafted'),
  mkPlayer('t1p4', 'Tre\' Harris', 'WR', 'LAC', false, 559, 169, 65, 321, 173, 66, 116.8, 68, 'Drafted'),
  mkPlayer('t1p5', 'Ashton Jeanty', 'RB', 'LV', true, 719, 9, 3, 481, 13, 5, 264.5, 5, 'Drafted'),
  mkPlayer('t1p6', 'Kaelon Black', 'RB', 'SF', false, 429, 299, 74, 194, 300, 85, 42.9, 69, 'Drafted'),
  mkPlayer('t1p7', 'Travis Kelce', 'TE', 'KC', false, 550, 178, 20, 397, 97, 9, 205.2, 9, 'Trade'),
  mkPlayer('t1p8', 'Hunter Henry', 'TE', 'NE', false, 517, 211, 27, 338, 156, 19, 180.4, 18, 'Waiver'),
  mkPlayer('t1p9', 'Dak Prescott', 'QB', 'DAL', false, 629, 99, 14, 415, 79, 10, 303.88, 7, 'Drafted'),
  mkPlayer('t1p10', 'Alvin Kamara', 'RB', 'NO', false, 458, 270, 60, 347, 147, 50, 47.5, 64, 'Trade'),
  mkPlayer('t1p11', 'A.J. Brown', 'WR', 'NE', true, 702, 26, 17, 480, 14, 9, 251.5, 10, 'Trade'),
  mkPlayer('t1p12', 'Daniel Jones', 'QB', 'IND', false, 555, 173, 27, 341, 153, 25, 231.52, 24, 'Waiver'),
  mkPlayer('t1p13', 'Jonathan Taylor', 'RB', 'IND', true, 708, 20, 7, 484, 10, 4, 275.9, 4, 'Trade'),
  mkPlayer('t1p14', 'Jalen Hurts', 'QB', 'PHI', true, 673, 55, 9, 436, 58, 6, 310.54, 5, 'Trade'),
  mkPlayer('t1p15', 'Rachaad White', 'RB', 'WAS', false, 544, 184, 41, 380, 114, 38, 125.9, 41, 'Drafted'),
  mkPlayer('t1p16', 'Garrett Wilson', 'WR', 'NYJ', true, 712, 16, 14, 467, 27, 14, 239.7, 13, 'Drafted'),
  mkPlayer('t1p17', 'Jameson Williams', 'WR', 'DET', true, 665, 63, 28, 444, 50, 27, 212.2, 23, 'Trade'),
  mkPlayer('t1p18', 'Malik Willis', 'QB', 'MIA', false, 563, 165, 25, 367, 127, 21, 252.78, 22, 'Waiver'),
  mkPlayer('t1p19', 'Isiah Pacheco', 'RB', 'DET', false, 488, 240, 51, 351, 143, 49, 54.6, 61, 'Waiver'),
  mkPlayer('t1p20', 'Jaxon Smith-Njigba', 'WR', 'SEA', true, 726, 2, 2, 489, 5, 3, 294.5, 3, 'Trade'),
  mkPlayer('t1p21', 'Josh Downs', 'WR', 'IND', false, 614, 114, 46, 398, 96, 44, 172.3, 47, 'Trade'),
]

// ---------------------------------------------------------------------------
// Team 2 — Josh top Zak bottom (owner: noahfight)
// ---------------------------------------------------------------------------
const t2Players: Player[] = [
  mkPlayer('t2p1', 'Marvin Harrison', 'WR', 'ARI', false, 691, 37, 27, 427, 67, 31, 181.7, 36, 'Drafted'),
  mkPlayer('t2p2', 'Ryan Flournoy', 'WR', 'DAL', false, 456, 272, 97, 309, 185, 70, 125.9, 64, 'Waiver'),
  mkPlayer('t2p3', 'Dylan Sampson', 'RB', 'CLE', false, 516, 212, 46, 352, 142, 48, 91.0, 45, 'Waiver'),
  mkPlayer('t2p4', 'Harold Fannin', 'TE', 'CLE', true, 660, 68, 6, 422, 72, 6, 224.8, 6, 'Drafted'),
  mkPlayer('t2p5', 'Luther Burden', 'WR', 'CHI', true, 682, 46, 21, 449, 45, 23, 209.9, 24, 'Drafted'),
  mkPlayer('t2p6', 'Tyler Shough', 'QB', 'NO', true, 578, 150, 22, 372, 122, 20, 260.0, 21, 'Waiver'),
  mkPlayer('t2p7', 'Kyle Williams', 'WR', 'NE', false, 478, 250, 93, 208, 286, 103, 32.2, 109, 'Drafted'),
  mkPlayer('t2p8', 'Ted Hurst', 'WR', 'TB', false, 540, 188, 72, 239, 255, 94, 101.5, 74, 'Drafted'),
  mkPlayer('t2p9', 'Matthew Stafford', 'QB', 'LAR', false, 562, 166, 26, 391, 103, 15, 280.22, 16, 'Waiver'),
  mkPlayer('t2p10', 'Mark Andrews', 'TE', 'BAL', false, 571, 157, 17, 363, 131, 15, 190.5, 14, 'Drafted'),
  mkPlayer('t2p11', 'Kyler Murray', 'QB', 'MIN', false, 586, 142, 21, 379, 115, 17, 265.2, 19, 'Drafted'),
  mkPlayer('t2p12', 'Josh Jacobs', 'RB', 'GB', true, 636, 92, 22, 448, 46, 16, 205.9, 19, 'Trade'),
  mkPlayer('t2p13', 'Rico Dowdle', 'RB', 'PIT', false, 572, 156, 34, 408, 86, 32, 158.2, 32, 'Waiver'),
  mkPlayer('t2p14', 'Jauan Jennings', 'WR', 'MIN', false, 548, 180, 66, 348, 146, 56, 125.4, 65, 'Waiver'),
  mkPlayer('t2p15', 'Ja\'Marr Chase', 'WR', 'CIN', true, 727, 1, 1, 493, 1, 1, 322.0, 2, 'Drafted'),
  mkPlayer('t2p16', 'James Cook', 'RB', 'BUF', true, 709, 19, 8, 479, 15, 6, 263.9, 6, 'Drafted'),
  mkPlayer('t2p17', 'Christian Watson', 'WR', 'GB', true, 643, 85, 31, 438, 56, 28, 194.1, 30, 'Drafted'),
  mkPlayer('t2p18', 'Jordan Mason', 'RB', 'MIN', false, 524, 204, 45, 365, 129, 40, 155.7, 35, 'Waiver'),
  mkPlayer('t2p19', 'Tucker Kraft', 'TE', 'GB', false, 662, 66, 5, 426, 68, 5, 213.3, 7, 'Waiver'),
  mkPlayer('t2p20', 'Keaton Mitchell', 'RB', 'LAC', false, 476, 252, 53, 334, 160, 52, 98.7, 44, 'Waiver'),
  mkPlayer('t2p21', 'Zay Flowers', 'WR', 'BAL', true, 683, 45, 18, 461, 33, 18, 236.3, 14, 'Drafted'),
]

// ---------------------------------------------------------------------------
// Team 3 — doingpunishment (owner: doingpunishment)
// ---------------------------------------------------------------------------
const t3Players: Player[] = [
  mkPlayer('t3p1', 'Jayden Reed', 'WR', 'GB', true, 598, 130, 51, 381, 113, 48, 171.6, 49, 'Drafted'),
  mkPlayer('t3p2', 'Drake Maye', 'QB', 'NE', true, 699, 29, 2, 460, 34, 3, 320.76, 2, 'Drafted'),
  mkPlayer('t3p3', 'Trey Benson', 'RB', 'ARI', false, 440, 288, 61, 220, 274, 79, 27.5, 75, 'Drafted'),
  mkPlayer('t3p4', 'Malik Washington', 'WR', 'MIA', false, 455, 273, 98, 274, 220, 80, 104.4, 70, 'Waiver'),
  mkPlayer('t3p5', 'Jack Bech', 'WR', 'LV', false, 489, 239, 85, 244, 250, 91, 92.7, 88, 'Drafted'),
  mkPlayer('t3p6', 'Ollie Gordon', 'RB', 'MIA', false, 434, 294, 64, 245, 249, 67, 23.5, 77, 'Drafted'),
  mkPlayer('t3p7', 'Quinshon Judkins', 'RB', 'CLE', true, 667, 61, 13, 434, 60, 22, 199.9, 22, 'Drafted'),
  mkPlayer('t3p8', 'Cam Ward', 'QB', 'TEN', false, 591, 137, 19, 350, 144, 24, 227.84, 25, 'Trade'),
  mkPlayer('t3p9', 'LeQuint Allen', 'RB', 'JAX', false, 282, 446, 92, 211, 283, 76, 58.0, 56, 'Waiver'),
  mkPlayer('t3p10', 'Max Klare', 'TE', 'LAR', false, 512, 216, 29, 155, 339, 39, 69.3, 32, 'Drafted'),
  mkPlayer('t3p11', 'Nicholas Singleton', 'RB', 'TEN', false, 527, 201, 47, 276, 218, 63, 64.9, 51, 'Drafted'),
  mkPlayer('t3p12', 'Makai Lemon', 'WR', 'PHI', true, 676, 52, 25, 399, 95, 43, 174.5, 40, 'Drafted'),
  mkPlayer('t3p13', 'KC Concepcion', 'WR', 'CLE', true, 649, 79, 32, 369, 125, 52, 162.2, 56, 'Drafted'),
  mkPlayer('t3p14', 'Mike Washington', 'RB', 'LV', true, 490, 238, 54, 298, 196, 60, 62.9, 52, 'Drafted'),
  mkPlayer('t3p15', 'Stefon Diggs', 'WR', 'FA', false, 529, 199, 69, 336, 158, 61, 176.7, 38, 'Drafted'),
  mkPlayer('t3p16', 'Tyreek Hill', 'WR', 'FA', false, 573, 155, 91, 271, 223, 82, 97.0, 81, 'Drafted'),
  mkPlayer('t3p17', 'George Kittle', 'TE', 'SF', false, 611, 117, 10, 382, 112, 11, 191.9, 12, 'Drafted'),
  mkPlayer('t3p18', 'Juwan Johnson', 'TE', 'NO', true, 534, 194, 24, 356, 138, 16, 169.0, 22, 'Waiver'),
  mkPlayer('t3p19', 'Rashid Shaheed', 'WR', 'SEA', false, 558, 170, 63, 345, 149, 57, 137.0, 60, 'Drafted'),
  mkPlayer('t3p20', 'Parker Washington', 'WR', 'JAX', true, 620, 108, 43, 402, 92, 41, 197.2, 28, 'Waiver'),
  mkPlayer('t3p21', 'Marvin Mims', 'WR', 'DEN', false, 457, 271, 100, 234, 260, 96, 72.6, 99, 'Waiver'),
]

// ---------------------------------------------------------------------------
// Team 4 — alexc222 (owner: alexc222)
// ---------------------------------------------------------------------------
const t4Players: Player[] = [
  mkPlayer('t4p1', 'MarShawn Lloyd', 'RB', 'GB', false, 425, 303, 71, 232, 262, 70, 47.1, 65, 'Drafted'),
  mkPlayer('t4p2', 'Blake Corum', 'RB', 'LAR', false, 581, 147, 33, 384, 110, 36, 136.8, 38, 'Other'),
  mkPlayer('t4p3', 'Malik Nabers', 'WR', 'NYG', true, 718, 10, 7, 464, 30, 17, 226.9, 16, 'Drafted'),
  mkPlayer('t4p4', 'Woody Marks', 'RB', 'HOU', false, 539, 189, 42, 361, 133, 43, 85.7, 46, 'Waiver'),
  mkPlayer('t4p5', 'Terrance Ferguson', 'TE', 'LAR', false, 530, 198, 23, 251, 243, 27, 94.2, 29, 'Trade'),
  mkPlayer('t4p6', 'Bhayshul Tuten', 'RB', 'JAX', true, 630, 98, 24, 423, 71, 26, 178.0, 25, 'Drafted'),
  mkPlayer('t4p7', 'Pat Bryant', 'WR', 'DEN', false, 497, 231, 82, 288, 206, 78, 99.9, 78, 'Drafted'),
  mkPlayer('t4p8', 'Oronde Gadsden', 'TE', 'LAC', true, 615, 113, 12, 340, 154, 18, 184.8, 16, 'Trade'),
  mkPlayer('t4p9', 'Kaleb Johnson', 'RB', 'PIT', false, 468, 260, 59, 228, 266, 74, 32.5, 71, 'Drafted'),
  mkPlayer('t4p10', 'Elijah Arroyo', 'TE', 'SEA', false, 481, 247, 36, 131, 363, 42, 89.6, 30, 'Waiver'),
  mkPlayer('t4p11', 'Ja\'Kobi Lane', 'WR', 'BAL', false, 506, 222, 89, 191, 303, 108, 93.3, 87, 'Drafted'),
  mkPlayer('t4p12', 'Kaytron Allen', 'RB', 'WAS', false, 496, 232, 57, 277, 217, 64, 46.7, 66, 'Drafted'),
  mkPlayer('t4p13', 'Jared Goff', 'QB', 'DET', false, 602, 126, 16, 386, 108, 16, 283.46, 14, 'Drafted'),
  mkPlayer('t4p14', 'Tee Higgins', 'WR', 'CIN', true, 674, 54, 22, 462, 32, 16, 222.5, 20, 'Trade'),
  mkPlayer('t4p15', 'Trevor Lawrence', 'QB', 'JAX', true, 657, 71, 10, 419, 75, 9, 303.42, 8, 'Trade'),
  mkPlayer('t4p16', 'Nico Collins', 'WR', 'HOU', true, 707, 21, 9, 482, 12, 8, 253.8, 8, 'Drafted'),
  mkPlayer('t4p17', 'Rhamondre Stevenson', 'RB', 'NE', false, 580, 148, 32, 412, 82, 29, 169.2, 29, 'Drafted'),
  mkPlayer('t4p18', 'Jahmyr Gibbs', 'RB', 'DET', true, 723, 5, 2, 490, 4, 2, 313.9, 2, 'Drafted'),
  mkPlayer('t4p19', 'Puka Nacua', 'WR', 'LAR', true, 722, 6, 3, 491, 3, 2, 323.2, 1, 'Waiver'),
  mkPlayer('t4p20', 'Tyjae Spears', 'RB', 'TEN', false, 498, 230, 50, 354, 140, 46, 118.1, 42, 'Drafted'),
  mkPlayer('t4p21', 'Jordan Addison', 'WR', 'MIN', false, 634, 94, 36, 387, 107, 47, 174.2, 42, 'Drafted'),
]

// ---------------------------------------------------------------------------
// Team 5 — MegaMoneyMoves (owner: JaQuavis00)
// ---------------------------------------------------------------------------
const t5Players: Player[] = [
  mkPlayer('t5p1', 'Michael Wilson', 'WR', 'ARI', true, 623, 105, 39, 407, 87, 39, 171.9, 48, 'Trade'),
  mkPlayer('t5p2', 'Dalton Kincaid', 'TE', 'BUF', true, 647, 81, 11, 383, 111, 12, 194.9, 11, 'Trade'),
  mkPlayer('t5p3', 'Bo Nix', 'QB', 'DEN', false, 638, 90, 13, 393, 101, 14, 295.72, 12, 'Waiver'),
  mkPlayer('t5p4', 'Bucky Irving', 'RB', 'TB', false, 654, 74, 18, 437, 57, 20, 200.9, 21, 'Trade'),
  mkPlayer('t5p5', 'Ja\'Tavion Sanders', 'TE', 'CAR', false, 380, 348, 46, 129, 365, 41, 48.0, 33, 'Waiver'),
  mkPlayer('t5p6', 'Rome Odunze', 'WR', 'CHI', true, 685, 43, 26, 435, 59, 29, 193.9, 31, 'Trade'),
  mkPlayer('t5p7', 'Tyrone Tracy', 'RB', 'NYG', false, 535, 193, 44, 366, 128, 41, 113.4, 43, 'Waiver'),
  mkPlayer('t5p8', 'Matthew Golden', 'WR', 'GB', false, 599, 129, 53, 355, 139, 55, 164.1, 55, 'Drafted'),
  mkPlayer('t5p9', 'Gunnar Helm', 'TE', 'TEN', false, 519, 209, 26, 270, 224, 25, 151.5, 25, 'Waiver'),
  mkPlayer('t5p10', 'Tetairoa McMillan', 'WR', 'CAR', true, 713, 15, 10, 466, 28, 15, 223.3, 19, 'Drafted'),
  mkPlayer('t5p11', 'Omar Cooper', 'WR', 'NYJ', false, 628, 100, 37, 342, 152, 60, 131.6, 62, 'Drafted'),
  mkPlayer('t5p12', 'Antonio Williams', 'WR', 'WAS', false, 579, 149, 58, 307, 187, 71, 100.5, 76, 'Drafted'),
  mkPlayer('t5p13', 'Matt Hibner', 'TE', 'BAL', false, 331, 397, 55, 1, 493, null, 39.6, 35, 'Waiver'),
  mkPlayer('t5p14', 'Kevin Coleman', 'WR', 'MIA', false, 435, 293, 104, 55, 439, 139, 33.6, 108, 'Drafted'),
  mkPlayer('t5p15', 'Eli Stowers', 'TE', 'PHI', false, 613, 115, 13, 217, 277, 33, 100.0, 26, 'Drafted'),
  mkPlayer('t5p16', 'Jacoby Brissett', 'QB', 'ARI', false, 465, 263, 34, 295, 199, 27, 160.0, 29, 'Waiver'),
  mkPlayer('t5p17', 'Joe Burrow', 'QB', 'CIN', true, 678, 50, 5, 452, 42, 4, 306.12, 6, 'Trade'),
  mkPlayer('t5p18', 'George Pickens', 'WR', 'DAL', true, 692, 36, 11, 478, 16, 10, 253.7, 9, 'Trade'),
  mkPlayer('t5p19', 'Brian Robinson', 'RB', 'ATL', false, 479, 249, 56, 329, 165, 53, 71.2, 48, 'Trade'),
  mkPlayer('t5p20', 'Chase Brown', 'RB', 'CIN', true, 679, 49, 11, 473, 21, 8, 260.9, 7, 'Drafted'),
  mkPlayer('t5p21', 'De\'Von Achane', 'RB', 'MIA', true, 705, 23, 5, 476, 18, 7, 255.6, 8, 'Trade'),
]

// ---------------------------------------------------------------------------
// Team 6 — McConkeys promise land (owner: LucasFFootball)
// ---------------------------------------------------------------------------
const t6Players: Player[] = [
  mkPlayer('t6p1', 'Rashee Rice', 'WR', 'KC', true, 675, 53, 23, 472, 22, 12, 240.5, 11, 'Drafted'),
  mkPlayer('t6p2', 'Brian Thomas', 'WR', 'JAX', true, 661, 67, 29, 413, 81, 37, 201.6, 26, 'Trade'),
  mkPlayer('t6p3', 'Ladd McConkey', 'WR', 'LAC', true, 695, 33, 16, 458, 36, 19, 218.0, 21, 'Drafted'),
  mkPlayer('t6p4', 'Keon Coleman', 'WR', 'BUF', false, 462, 266, 94, 240, 254, 92, 40.2, 106, 'Trade'),
  mkPlayer('t6p5', 'Jaxson Dart', 'QB', 'NYG', true, 653, 75, 11, 405, 89, 11, 300.54, 10, 'Trade'),
  mkPlayer('t6p6', 'TreVeyon Henderson', 'RB', 'NE', true, 663, 65, 14, 433, 61, 21, 183.0, 24, 'Drafted'),
  mkPlayer('t6p7', 'Kyle Monangai', 'RB', 'CHI', true, 583, 145, 30, 395, 99, 34, 156.9, 34, 'Trade'),
  mkPlayer('t6p8', 'Isaac TeSlaa', 'WR', 'DET', false, 495, 233, 84, 293, 201, 75, 108.7, 69, 'Waiver'),
  mkPlayer('t6p9', 'Jadarian Price', 'RB', 'SEA', false, 642, 86, 21, 418, 76, 27, 171.9, 27, 'Drafted'),
  mkPlayer('t6p10', 'Chris Bell', 'WR', 'MIA', false, 566, 162, 61, 264, 230, 84, 94.5, 84, 'Drafted'),
  mkPlayer('t6p11', 'Kenyon Sadiq', 'TE', 'NYJ', true, 631, 97, 9, 294, 200, 23, 169.9, 21, 'Trade'),
  mkPlayer('t6p12', 'Brenen Thompson', 'WR', 'LAC', false, 448, 280, 103, 113, 381, 130, 40.4, 105, 'Drafted'),
  mkPlayer('t6p13', 'De\'Zhaun Stribling', 'WR', 'SF', false, 542, 186, 67, 258, 236, 88, 118.3, 67, 'Drafted'),
  mkPlayer('t6p14', 'Eli Raridon', 'TE', 'NE', false, 526, 202, 28, 50, 444, 53, 41.4, 34, 'Waiver'),
  mkPlayer('t6p15', 'Evan Engram', 'TE', 'DEN', false, 403, 325, 42, 223, 271, 32, 89.3, 31, 'Drafted'),
  mkPlayer('t6p16', 'Deebo Samuel', 'WR', 'FA', false, 509, 219, 78, 320, 174, 67, 128.1, 63, 'Drafted'),
  mkPlayer('t6p17', 'D\'Andre Swift', 'RB', 'CHI', false, 627, 101, 25, 432, 62, 23, 203.6, 20, 'Drafted'),
  mkPlayer('t6p18', 'Wan\'Dale Robinson', 'WR', 'TEN', true, 619, 109, 42, 403, 91, 40, 166.6, 54, 'Trade'),
  mkPlayer('t6p19', 'Brock Purdy', 'QB', 'SF', false, 648, 80, 12, 400, 94, 12, 295.66, 13, 'Drafted'),
  mkPlayer('t6p20', 'Zach Charbonnet', 'RB', 'SEA', false, 588, 140, 29, 359, 135, 45, 68.3, 49, 'Drafted'),
]

// ---------------------------------------------------------------------------
// Team 7 — cypoheb (owner: cypoheb)
// ---------------------------------------------------------------------------
const t7Players: Player[] = [
  mkPlayer('t7p1', 'RJ Harvey', 'RB', 'DEN', false, 601, 127, 27, 404, 90, 31, 147.8, 37, 'Drafted'),
  mkPlayer('t7p2', 'Elic Ayomanor', 'WR', 'TEN', false, 486, 242, 86, 259, 235, 87, 58.7, 102, 'Drafted'),
  mkPlayer('t7p3', 'Emeka Egbuka', 'WR', 'TB', true, 704, 24, 12, 453, 41, 21, 227.5, 15, 'Drafted'),
  mkPlayer('t7p4', 'Germie Bernard', 'WR', 'PIT', false, 553, 175, 64, 262, 232, 86, 102.5, 72, 'Drafted'),
  mkPlayer('t7p5', 'Malachi Fields', 'WR', 'NYG', false, 504, 224, 81, 227, 267, 97, 84.4, 94, 'Drafted'),
  mkPlayer('t7p6', 'Denzel Boston', 'WR', 'CLE', false, 605, 123, 49, 344, 150, 58, 140.0, 58, 'Drafted'),
  mkPlayer('t7p7', 'Davante Adams', 'WR', 'LAR', true, 621, 107, 41, 445, 49, 24, 194.3, 29, 'Drafted'),
  mkPlayer('t7p8', 'David Njoku', 'TE', 'LAC', false, 505, 223, 31, 250, 244, 30, 98.3, 27, 'Drafted'),
  mkPlayer('t7p9', 'Christian McCaffrey', 'RB', 'SF', true, 687, 41, 15, 487, 7, 3, 298.0, 3, 'Drafted'),
  mkPlayer('t7p10', 'Chris Godwin', 'WR', 'TB', false, 603, 125, 50, 416, 78, 35, 180.4, 37, 'Drafted'),
  mkPlayer('t7p11', 'Aaron Jones', 'RB', 'MIN', true, 513, 215, 49, 385, 109, 37, 153.9, 36, 'Drafted'),
  mkPlayer('t7p12', 'Lamar Jackson', 'QB', 'BAL', true, 693, 35, 4, 463, 31, 2, 320.0, 3, 'Drafted'),
  mkPlayer('t7p13', 'Marquise Brown', 'WR', 'PHI', false, 1, 727, null, 2, 492, null, 70.0, 100, 'Trade'),
  mkPlayer('t7p14', 'Michael Pittman', 'WR', 'PIT', true, 641, 87, 44, 411, 83, 36, 174.3, 41, 'Drafted'),
  mkPlayer('t7p15', 'Najee Harris', 'RB', 'FA', false, 384, 344, 76, 184, 310, 86, 53.5, 62, 'Trade'),
  mkPlayer('t7p16', 'Amon-Ra St. Brown', 'WR', 'DET', true, 720, 8, 5, 488, 6, 4, 291.1, 4, 'Drafted'),
  mkPlayer('t7p17', 'Jake Ferguson', 'TE', 'DAL', true, 606, 122, 14, 389, 105, 10, 201.8, 10, 'Waiver'),
  mkPlayer('t7p18', 'Isaiah Likely', 'TE', 'NYG', false, 609, 119, 15, 378, 116, 13, 186.6, 15, 'Drafted'),
  mkPlayer('t7p19', 'Alec Pierce', 'WR', 'IND', false, 639, 89, 35, 424, 70, 32, 191.2, 32, 'Waiver'),
  mkPlayer('t7p20', 'Brenton Strange', 'TE', 'JAX', false, 589, 139, 16, 346, 148, 17, 190.8, 13, 'Waiver'),
  mkPlayer('t7p21', 'C.J. Stroud', 'QB', 'HOU', false, 633, 95, 20, 360, 134, 22, 234.2, 23, 'Trade'),
]

// ---------------------------------------------------------------------------
// Team 8 — Justin Time (owner: joshmandel)
// ---------------------------------------------------------------------------
const t8Players: Player[] = [
  mkPlayer('t8p1', 'J.J. McCarthy', 'QB', 'MIN', false, 492, 236, 31, 134, 360, 36, 19.62, 31, 'Waiver'),
  mkPlayer('t8p2', 'Jayden Daniels', 'QB', 'WAS', true, 689, 39, 3, 440, 54, 5, 313.72, 4, 'Trade'),
  mkPlayer('t8p3', 'Braelon Allen', 'RB', 'NYJ', false, 477, 251, 58, 326, 168, 54, 54.8, 60, 'Drafted'),
  mkPlayer('t8p4', 'Ben Sinnott', 'TE', 'WAS', false, 401, 327, 47, 30, 464, 58, 39.2, 36, 'Drafted'),
  mkPlayer('t8p5', 'Theo Johnson', 'TE', 'NYG', false, 464, 264, 37, 214, 280, 35, 95.6, 28, 'Waiver'),
  mkPlayer('t8p6', 'Jalen Coker', 'WR', 'CAR', false, 576, 152, 59, 364, 130, 54, 169.3, 52, 'Waiver'),
  mkPlayer('t8p7', 'Jaydon Blue', 'RB', 'DAL', false, 395, 333, 72, 225, 269, 73, 45.6, 67, 'Drafted'),
  mkPlayer('t8p8', 'J\'Mari Taylor', 'RB', 'JAX', false, 296, 432, 89, 101, 393, 117, 31.2, 72, 'Drafted'),
  mkPlayer('t8p9', 'Mike Evans', 'WR', 'SF', false, 622, 106, 40, 443, 51, 25, 212.6, 22, 'Drafted'),
  mkPlayer('t8p10', 'Sam Darnold', 'QB', 'SEA', false, 574, 154, 23, 357, 137, 23, 262.74, 20, 'Waiver'),
  mkPlayer('t8p11', 'DJ Moore', 'WR', 'BUF', false, 655, 73, 33, 441, 53, 26, 185.3, 34, 'Drafted'),
  mkPlayer('t8p12', 'Dallas Goedert', 'TE', 'PHI', false, 577, 151, 18, 373, 121, 14, 173.8, 20, 'Trade'),
  mkPlayer('t8p13', 'Courtland Sutton', 'WR', 'DEN', false, 612, 116, 47, 420, 74, 34, 173.1, 45, 'Trade'),
  mkPlayer('t8p14', 'David Montgomery', 'RB', 'HOU', true, 616, 112, 26, 430, 64, 24, 199.6, 23, 'Trade'),
  mkPlayer('t8p15', 'Terry McLaurin', 'WR', 'WAS', true, 644, 84, 30, 450, 44, 22, 223.7, 18, 'Trade'),
  mkPlayer('t8p16', 'Justin Jefferson', 'WR', 'MIN', true, 724, 4, 4, 485, 9, 6, 259.4, 6, 'Drafted'),
  mkPlayer('t8p17', 'Kenny Gainwell', 'RB', 'TB', false, 554, 174, 38, 396, 98, 33, 157.0, 33, 'Waiver'),
  mkPlayer('t8p18', 'Javonte Williams', 'RB', 'DAL', true, 650, 78, 20, 446, 48, 18, 211.0, 17, 'Drafted'),
  mkPlayer('t8p19', 'Trey McBride', 'TE', 'ARI', true, 700, 28, 2, 477, 17, 1, 300.3, 1, 'Waiver'),
  mkPlayer('t8p20', 'Breece Hall', 'RB', 'NYJ', true, 710, 18, 9, 454, 40, 14, 218.4, 14, 'Trade'),
  mkPlayer('t8p21', 'Jaylen Warren', 'RB', 'PIT', true, 590, 138, 28, 425, 69, 25, 174.2, 26, 'Drafted'),
]

// ---------------------------------------------------------------------------
// Team 9 — elithefighter (owner: elithefighter)
// ---------------------------------------------------------------------------
const t9Players: Player[] = [
  mkPlayer('t9p1', 'Andrei Iosivas', 'WR', 'CIN', false, 370, 358, 121, 197, 297, 107, 94.5, 85, 'Waiver'),
  mkPlayer('t9p2', 'Emanuel Wilson', 'RB', 'SEA', false, 431, 297, 65, 306, 188, 57, 57.6, 58, 'Waiver'),
  mkPlayer('t9p3', 'Audric Estime', 'RB', 'NO', false, 237, 491, 97, 135, 359, 96, 22.9, 78, 'Drafted'),
  mkPlayer('t9p4', 'Xavier Worthy', 'WR', 'KC', false, 608, 120, 48, 371, 123, 51, 167.0, 53, 'Drafted'),
  mkPlayer('t9p5', 'Roman Wilson', 'WR', 'PIT', false, 196, 532, 175, 31, 463, 158, 27.7, 110, 'Drafted'),
  mkPlayer('t9p6', 'Colston Loveland', 'TE', 'CHI', true, 690, 38, 3, 457, 37, 3, 254.9, 3, 'Drafted'),
  mkPlayer('t9p7', 'Travis Hunter', 'WR', 'JAX', false, 594, 134, 55, 328, 166, 63, 100.1, 77, 'Drafted'),
  mkPlayer('t9p8', 'Jacory Croskey-Merritt', 'RB', 'WAS', true, 547, 181, 40, 370, 124, 39, 129.8, 40, 'Drafted'),
  mkPlayer('t9p9', 'Carnell Tate', 'WR', 'TEN', true, 698, 30, 15, 431, 63, 30, 197.4, 27, 'Drafted'),
  mkPlayer('t9p10', 'Adam Randall', 'RB', 'BAL', false, 415, 313, 73, 170, 324, 92, 30.9, 73, 'Drafted'),
  mkPlayer('t9p11', 'Zachariah Branch', 'WR', 'ATL', false, 503, 225, 79, 247, 247, 90, 104.3, 71, 'Drafted'),
  mkPlayer('t9p12', 'Emmett Johnson', 'RB', 'KC', false, 511, 217, 52, 310, 184, 58, 66.4, 50, 'Drafted'),
  mkPlayer('t9p13', 'Jonah Coleman', 'RB', 'DEN', false, 561, 167, 37, 335, 159, 51, 60.3, 54, 'Drafted'),
  mkPlayer('t9p14', 'Skyler Bell', 'WR', 'BUF', false, 507, 221, 76, 186, 308, 109, 95.4, 82, 'Drafted'),
  mkPlayer('t9p15', 'Patrick Mahomes', 'QB', 'KC', true, 686, 42, 7, 394, 100, 13, 278.62, 17, 'Drafted'),
  mkPlayer('t9p16', 'Dalton Schultz', 'TE', 'HOU', true, 499, 229, 30, 324, 170, 21, 166.5, 23, 'Waiver'),
  mkPlayer('t9p17', 'Brandon Aiyuk', 'WR', 'SF', false, 618, 110, 60, 299, 195, 73, 133.3, 61, 'Drafted'),
  mkPlayer('t9p18', 'Chuba Hubbard', 'RB', 'CAR', true, 587, 141, 31, 414, 80, 28, 171.1, 28, 'Drafted'),
  mkPlayer('t9p19', 'Drake London', 'WR', 'ATL', true, 716, 12, 8, 483, 11, 7, 259.2, 7, 'Drafted'),
  mkPlayer('t9p20', 'Treylon Burks', 'WR', 'WAS', false, 238, 490, 164, 102, 392, 132, 36.0, 107, 'Waiver'),
  mkPlayer('t9p21', 'Kenneth Walker', 'RB', 'KC', true, 697, 31, 10, 465, 29, 11, 234.0, 13, 'Trade'),
  mkPlayer('t9p22', 'Jalen Nailor', 'WR', 'LV', false, 485, 243, 80, 290, 204, 76, 146.1, 57, 'Waiver'),
  mkPlayer('t9p23', 'Tank Bigsby', 'RB', 'PHI', false, 480, 248, 55, 322, 172, 55, 58.0, 57, 'Drafted'),
  mkPlayer('t9p24', 'Bryce Young', 'QB', 'CAR', false, 564, 164, 24, 339, 155, 26, 225.26, 26, 'Drafted'),
  mkPlayer('t9p25', 'DeMario Douglas', 'WR', 'NE', false, 416, 312, 108, 109, 385, 127, 61.3, 101, 'Trade'),
  mkPlayer('t9p26', 'Kayshon Boutte', 'WR', 'NE', false, 515, 213, 74, 313, 181, 69, 97.7, 80, 'Drafted'),
  mkPlayer('t9p27', 'Quentin Johnston', 'WR', 'LAC', false, 595, 133, 54, 388, 106, 46, 169.7, 50, 'Drafted'),
]

// ---------------------------------------------------------------------------
// Team 10 — Goodwinontop (owner: Goodwinontop)
// ---------------------------------------------------------------------------
const t10Players: Player[] = [
  mkPlayer('t10p1', 'Jalen McMillan', 'WR', 'TB', false, 556, 172, 62, 330, 164, 62, 137.2, 59, 'Drafted'),
  mkPlayer('t10p2', 'Ty Simpson', 'QB', 'LAR', false, 549, 179, 28, 92, 402, 41, 13.62, 32, 'Drafted'),
  mkPlayer('t10p3', 'Geno Smith', 'QB', 'NYJ', false, 471, 257, 33, 260, 234, 28, 222.48, 27, 'Drafted'),
  mkPlayer('t10p4', 'Keenan Allen', 'WR', 'FA', false, 409, 319, 114, 209, 285, 102, 98.8, 79, 'Trade'),
  mkPlayer('t10p5', 'Derrick Henry', 'RB', 'BAL', true, 637, 91, 23, 455, 39, 13, 245.2, 11, 'Trade'),
  mkPlayer('t10p6', 'James Conner', 'RB', 'ARI', false, 430, 298, 66, 319, 175, 56, 61.0, 53, 'Trade'),
  mkPlayer('t10p7', 'Saquon Barkley', 'RB', 'PHI', true, 671, 57, 12, 469, 25, 9, 247.0, 9, 'Trade'),
  mkPlayer('t10p8', 'Calvin Ridley', 'WR', 'TEN', false, 483, 245, 87, 296, 198, 74, 80.0, 95, 'Trade'),
  mkPlayer('t10p9', 'Josh Allen', 'QB', 'BUF', true, 714, 14, 1, 471, 23, 1, 361.5, 1, 'Drafted'),
  mkPlayer('t10p10', 'T.J. Hockenson', 'TE', 'MIN', true, 543, 185, 22, 316, 178, 22, 165.7, 24, 'Drafted'),
  mkPlayer('t10p11', 'DK Metcalf', 'WR', 'PIT', true, 656, 72, 34, 421, 73, 33, 189.5, 33, 'Drafted'),
  mkPlayer('t10p12', 'Jakobi Meyers', 'WR', 'JAX', true, 597, 131, 52, 401, 93, 42, 175.7, 39, 'Drafted'),
  mkPlayer('t10p13', 'Darius Slayton', 'WR', 'NYG', false, 394, 334, 111, 216, 278, 101, 89.4, 90, 'Waiver'),
  mkPlayer('t10p14', 'CeeDee Lamb', 'WR', 'DAL', true, 721, 7, 6, 486, 8, 5, 280.1, 5, 'Drafted'),
  mkPlayer('t10p15', 'Travis Etienne', 'RB', 'NO', true, 668, 60, 17, 447, 47, 17, 211.3, 15, 'Drafted'),
  mkPlayer('t10p16', 'Rashod Bateman', 'WR', 'BAL', false, 452, 276, 101, 254, 240, 89, 86.9, 93, 'Waiver'),
  mkPlayer('t10p17', 'Calvin Austin', 'WR', 'NYG', false, 355, 373, 120, 141, 353, 118, 45.0, 103, 'Waiver'),
  mkPlayer('t10p18', 'Tyler Allgeier', 'RB', 'ARI', false, 533, 195, 43, 358, 136, 44, 72.6, 47, 'Drafted'),
  mkPlayer('t10p19', 'Chig Okonkwo', 'TE', 'WAS', false, 565, 163, 19, 332, 162, 20, 180.7, 17, 'Waiver'),
]

// ---------------------------------------------------------------------------
// Team 11 — Dj29 (owner: Dj29)
// ---------------------------------------------------------------------------
const t11Players: Player[] = [
  mkPlayer('t11p1', 'Ray Davis', 'RB', 'BUF', false, 437, 291, 63, 289, 205, 61, 58.9, 55, 'Drafted'),
  mkPlayer('t11p2', 'AJ Barner', 'TE', 'SEA', false, 546, 182, 21, 283, 211, 24, 177.2, 19, 'Waiver'),
  mkPlayer('t11p3', 'Troy Franklin', 'WR', 'DEN', false, 510, 218, 75, 315, 179, 68, 88.6, 91, 'Drafted'),
  mkPlayer('t11p4', 'Devin Neal', 'RB', 'NO', false, 406, 322, 70, 229, 265, 72, 32.6, 70, 'Drafted'),
  mkPlayer('t11p5', 'Tory Horton', 'WR', 'SEA', false, 461, 267, 95, 222, 272, 99, 95.1, 83, 'Waiver'),
  mkPlayer('t11p6', 'Tyler Warren', 'TE', 'IND', true, 672, 56, 4, 442, 52, 4, 242.7, 4, 'Drafted'),
  mkPlayer('t11p7', 'Elijah Sarratt', 'WR', 'BAL', false, 538, 190, 70, 236, 258, 95, 92.3, 89, 'Drafted'),
  mkPlayer('t11p8', 'CJ Daniels', 'WR', 'LAR', false, 351, 377, 118, 39, 455, 152, 40.8, 104, 'Drafted'),
  mkPlayer('t11p9', 'Jordyn Tyson', 'WR', 'NO', true, 684, 44, 20, 409, 85, 38, 185.2, 35, 'Drafted'),
  mkPlayer('t11p10', 'Tony Pollard', 'RB', 'TEN', true, 569, 159, 35, 410, 84, 30, 162.9, 30, 'Drafted'),
  mkPlayer('t11p11', 'Ty Johnson', 'RB', 'BUF', false, 285, 443, 105, 235, 259, 69, 57.5, 59, 'Waiver'),
  mkPlayer('t11p12', 'Devin Singletary', 'RB', 'NYG', false, 341, 387, 91, 168, 326, 90, 12.8, 79, 'Waiver'),
  mkPlayer('t11p13', 'Jerry Jeudy', 'WR', 'CLE', false, 531, 197, 71, 343, 151, 59, 123.9, 66, 'Trade'),
  mkPlayer('t11p14', 'Justin Herbert', 'QB', 'LAC', true, 666, 62, 8, 428, 66, 8, 303.3, 9, 'Drafted'),
  mkPlayer('t11p15', 'Jordan Love', 'QB', 'GB', false, 626, 102, 15, 377, 117, 18, 282.52, 15, 'Trade'),
  mkPlayer('t11p16', 'J.K. Dobbins', 'RB', 'DEN', false, 552, 176, 39, 390, 104, 35, 162.8, 31, 'Trade'),
  mkPlayer('t11p17', 'DeVonta Smith', 'WR', 'PHI', true, 694, 34, 19, 470, 24, 13, 225.9, 17, 'Trade'),
  mkPlayer('t11p18', 'Jaylen Waddle', 'WR', 'DEN', true, 688, 40, 24, 456, 38, 20, 205.7, 25, 'Drafted'),
  mkPlayer('t11p19', 'Romeo Doubs', 'WR', 'NE', true, 585, 143, 56, 368, 126, 53, 172.9, 46, 'Trade'),
  mkPlayer('t11p20', 'Kyren Williams', 'RB', 'LAR', true, 664, 64, 16, 451, 43, 15, 211.2, 16, 'Waiver'),
  mkPlayer('t11p21', 'Sean Tucker', 'RB', 'TB', false, 418, 310, 69, 284, 210, 62, 53.3, 63, 'Waiver'),
]

// ---------------------------------------------------------------------------
// Team 12 — timmmimmi (owner: timmmimmi)
// ---------------------------------------------------------------------------
const t12Players: Player[] = [
  mkPlayer('t12p1', 'Sam LaPorta', 'TE', 'DET', false, 677, 51, 7, 406, 88, 8, 236.4, 5, 'Drafted'),
  mkPlayer('t12p2', 'Caleb Williams', 'QB', 'CHI', true, 670, 58, 6, 429, 65, 7, 299.34, 11, 'Drafted'),
  mkPlayer('t12p3', 'Adonai Mitchell', 'WR', 'NYJ', false, 520, 208, 73, 325, 169, 64, 101.8, 73, 'Trade'),
  mkPlayer('t12p4', 'Ricky Pearsall', 'WR', 'SF', true, 624, 104, 38, 392, 102, 45, 173.9, 43, 'Drafted'),
  mkPlayer('t12p5', 'Jaylen Wright', 'RB', 'MIA', false, 421, 307, 68, 267, 227, 65, 44.7, 68, 'Drafted'),
  mkPlayer('t12p6', 'Devaughn Vele', 'WR', 'NO', false, 386, 342, 115, 198, 296, 105, 94.3, 86, 'Waiver'),
  mkPlayer('t12p7', 'Cam Skattebo', 'RB', 'NYG', true, 652, 76, 19, 439, 55, 19, 206.9, 18, 'Drafted'),
  mkPlayer('t12p8', 'Jayden Higgins', 'WR', 'HOU', false, 617, 111, 45, 374, 120, 50, 169.4, 51, 'Drafted'),
  mkPlayer('t12p9', 'Isaiah Bond', 'WR', 'CLE', false, 375, 353, 116, 159, 335, 114, 74.4, 96, 'Waiver'),
  mkPlayer('t12p10', 'Omarion Hampton', 'RB', 'LAC', true, 715, 13, 6, 468, 26, 10, 246.7, 10, 'Drafted'),
  mkPlayer('t12p11', 'Shedeur Sanders', 'QB', 'CLE', false, 470, 258, 32, 165, 329, 33, 97.12, 30, 'Drafted'),
  mkPlayer('t12p12', 'Fernando Mendoza', 'QB', 'LV', false, 596, 132, 18, 253, 241, 30, 212.16, 28, 'Drafted'),
  mkPlayer('t12p13', 'Jeremiyah Love', 'RB', 'ARI', true, 717, 11, 4, 459, 35, 12, 244.3, 12, 'Drafted'),
  mkPlayer('t12p14', 'Chris Brazzell', 'WR', 'CAR', false, 528, 200, 77, 221, 273, 100, 87.6, 92, 'Drafted'),
  mkPlayer('t12p15', 'Kendrick Bourne', 'WR', 'ARI', false, 336, 392, 160, 133, 361, 121, 74.1, 97, 'Waiver'),
  mkPlayer('t12p16', 'Baker Mayfield', 'QB', 'TB', false, 593, 135, 17, 375, 119, 19, 274.88, 18, 'Waiver'),
  mkPlayer('t12p17', 'Nick Chubb', 'RB', 'FA', false, 374, 354, 107, 96, 398, 107, 28.4, 74, 'Drafted'),
  mkPlayer('t12p18', 'Kyle Pitts', 'TE', 'ATL', true, 659, 69, 8, 417, 77, 7, 211.2, 8, 'Drafted'),
  mkPlayer('t12p19', 'Khalil Shakir', 'WR', 'BUF', false, 582, 146, 57, 376, 118, 49, 173.4, 44, 'Waiver'),
  mkPlayer('t12p20', 'Chris Olave', 'WR', 'NO', true, 706, 22, 13, 475, 19, 11, 239.8, 12, 'Drafted'),
  mkPlayer('t12p21', 'Dontayvion Wicks', 'WR', 'PHI', false, 475, 253, 90, 278, 216, 79, 73.0, 98, 'Waiver'),
  mkPlayer('t12p22', 'Tank Dell', 'WR', 'HOU', false, 568, 160, 88, 263, 231, 85, 100.6, 75, 'Drafted'),
  mkPlayer('t12p23', 'Bijan Robinson', 'RB', 'ATL', true, 725, 3, 1, 492, 2, 1, 331.3, 1, 'Drafted'),
]

const rawTeams = [
  { id: 't1', name: 'ZakF', owner: 'ZakF', players: t1Players },
  { id: 't2', name: 'Josh top Zak bottom', owner: 'noahfight', players: t2Players },
  { id: 't3', name: 'doingpunishment', owner: 'doingpunishment', players: t3Players },
  { id: 't4', name: 'alexc222', owner: 'alexc222', players: t4Players },
  { id: 't5', name: 'MegaMoneyMoves', owner: 'JaQuavis00', players: t5Players },
  { id: 't6', name: 'McConkeys promise land', owner: 'LucasFFootball', players: t6Players },
  { id: 't7', name: 'cypoheb', owner: 'cypoheb', players: t7Players },
  { id: 't8', name: 'Justin Time', owner: 'joshmandel', players: t8Players },
  { id: 't9', name: 'elithefighter', owner: 'elithefighter', players: t9Players },
  { id: 't10', name: 'Goodwinontop', owner: 'Goodwinontop', players: t10Players },
  { id: 't11', name: 'Dj29', owner: 'Dj29', players: t11Players },
  { id: 't12', name: 'timmmimmi', owner: 'timmmimmi', players: t12Players },
]

export const LEAGUE: Team[] = rawTeams.map(({ id, name, owner, players }) => ({
  id,
  name,
  owner,
  players,
  totals: computeTotals(players),
}))