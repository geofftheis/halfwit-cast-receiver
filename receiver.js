/**
 * Half-Wit Cast Receiver
 *
 * This receiver app displays game state on a TV when cast from the Half-Wit Android app.
 * It receives JSON messages via the custom namespace and renders the appropriate screen.
 */

// Custom namespace for Half-Wit game messages
const HALFWIT_NAMESPACE = 'urn:x-cast:com.halfwit.game';

// Screen elements
const screens = {
    connecting: document.getElementById('connecting-screen'),
    lobby: document.getElementById('lobby-screen'),
    tutorial: document.getElementById('tutorial-screen'),
    loading: document.getElementById('loading-screen'),
    countdown: document.getElementById('countdown-screen'),
    answering: document.getElementById('answering-screen'),
    votingTransition: document.getElementById('voting-transition-screen'),
    matchupVoting: document.getElementById('matchup-voting-screen'),
    matchupResults: document.getElementById('matchup-results-screen'),
    roundResults: document.getElementById('round-results-screen'),
    gameResults: document.getElementById('game-results-screen'),
    end: document.getElementById('end-screen')
};

let currentScreen = 'connecting';

/**
 * Show a specific screen and hide all others
 */
function showScreen(screenName) {
    // If leaving the tutorial screen, clean up tutorial timeouts
    if (currentScreen === 'tutorial' && screenName !== 'tutorial') {
        clearTutorialTimeouts();
    }

    Object.keys(screens).forEach(name => {
        if (screens[name]) {
            screens[name].classList.remove('active');
        }
    });

    if (screens[screenName]) {
        screens[screenName].classList.add('active');
        currentScreen = screenName;
        console.log('Showing screen:', screenName);
    }
}

/**
 * Update timer circle styling based on time remaining
 */
function updateTimerStyle(element, seconds, totalSeconds) {
    element.classList.remove('warning', 'critical');
    if (seconds <= 5) {
        element.classList.add('critical');
    } else if (seconds <= 10) {
        element.classList.add('warning');
    }
}

// ── Per-icon visual tuning ──────────────────────────────────────────
// Each icon PNG has different amounts of transparent padding and visual
// weight. These ratios were hand-tuned so every icon looks consistently
// sized and centred. Values are fractions of the container size so they
// scale proportionally to any display size. Matches Android/iOS tuning.
const ICON_SIZE_RATIO = {
    accordion: 44/56,
    axolotl: 46/56, butterfly: 46/56, dumpster_fire: 46/56,
    goldfish_bag: 46/56, jellyfish: 46/56,
    cuckoo_clock: 48/56, mushroom: 48/56, telescope: 48/56,
    cactus: 50/56, disco_ball: 50/56,
    bonsai: 52/56, penguin: 52/56, rubber_duck: 52/56, ufo: 52/56,
    snail: 57/56
};
const ICON_OFFSET_Y = {
    axolotl: 3/56, cuckoo_clock: 1/56, disco_ball: 2/56, goldfish_bag: 2/56,
    jellyfish: -2/56, mushroom: -2/56, penguin: -2/56,
    cactus: -3/56, dumpster_fire: -3/56, rubber_duck: -3/56, snail: -3/56,
    ufo: -7/56
};
const ICON_OFFSET_X = {
    cuckoo_clock: 1/56, snail: 2/56, telescope: 2/56, rubber_duck: -1/56
};
const DEFAULT_SIZE_RATIO = 44/56;

/**
 * Create an <img> element for a player icon, scaled and offset so it
 * looks visually centred at any size.
 */
function createIconImg(iconId) {
    const img = document.createElement('img');
    img.src = 'icons/' + iconId + '.png';
    img.alt = iconId.replace(/_/g, ' ');
    img.className = 'player-icon';

    const scale = ICON_SIZE_RATIO[iconId] || DEFAULT_SIZE_RATIO;
    const offX  = ICON_OFFSET_X[iconId] || 0;
    const offY  = ICON_OFFSET_Y[iconId] || 0;

    // scale() shrinks the image within its layout box (box stays full size).
    // translate() offsets are relative to the element's own size after scale,
    // so we convert our container-fraction offsets to element-fraction by
    // dividing by scale: e.g. a 3/56 container offset on a 46/56-scaled
    // image becomes (3/56)/(46/56) = 3/46 of the image's own size.
    const txPct = scale !== 0 ? ((offX / scale) * 100).toFixed(2) : 0;
    const tyPct = scale !== 0 ? ((offY / scale) * 100).toFixed(2) : 0;
    img.style.transform = `scale(${scale.toFixed(4)}) translate(${txPct}%, ${tyPct}%)`;

    return img;
}

/**
 * Create a player card element
 */
function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card' + (player.isHost ? ' host' : '');

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.appendChild(createIconImg(player.iconId));

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = player.name;

    card.appendChild(icon);
    card.appendChild(name);

    return card;
}

/**
 * Create a leaderboard entry element
 */
function createLeaderboardEntry(player, showRoundScore = true, highlightTotalScore = false) {
    const entry = document.createElement('div');
    entry.className = 'leaderboard-entry rank-' + player.rank;
    entry.setAttribute('data-player-id', player.peerId || player.name);

    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = '#' + player.rank;

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.appendChild(createIconImg(player.iconId));

    const info = document.createElement('div');
    info.className = 'player-info';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = player.name;

    info.appendChild(name);

    // Score section on the right side
    const scoreSection = document.createElement('div');
    scoreSection.className = 'score-section';

    if (showRoundScore && player.roundScore !== undefined) {
        // Large round score in pink (e.g., "+2")
        const roundScore = document.createElement('div');
        roundScore.className = 'round-score';
        roundScore.textContent = '+' + player.roundScore;
        scoreSection.appendChild(roundScore);

        // Pre-create total score element (hidden) for crossfade during reorder
        const totalScoreReplace = document.createElement('div');
        totalScoreReplace.className = 'total-score-replace';
        const pts = player.totalScore === 1 ? 'Pt' : 'Pts';
        totalScoreReplace.textContent = player.totalScore + ' ' + pts;
        scoreSection.appendChild(totalScoreReplace);
    }

    if (highlightTotalScore) {
        // Final game results: just "X Pts"
        const totalScore = document.createElement('div');
        totalScore.className = 'total-score highlighted';
        const points = player.totalScore === 1 ? 'Pt' : 'Pts';
        totalScore.textContent = player.totalScore + ' ' + points;
        scoreSection.appendChild(totalScore);
    }

    entry.appendChild(rank);
    entry.appendChild(icon);
    entry.appendChild(info);
    entry.appendChild(scoreSection);

    return entry;
}

/**
 * Create a voter icon element
 */
function createVoterIcon(iconId, isAbstain = false) {
    const icon = document.createElement('span');
    icon.className = isAbstain ? 'abstain-icon' : 'voter-icon';
    icon.appendChild(createIconImg(iconId));
    return icon;
}

/**
 * Handle incoming game messages
 */
function handleMessage(message) {
    console.log('Received message:', message);

    try {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'lobby':
                updateLobbyScreen(data);
                showScreen('lobby');
                break;

            case 'tutorial':
                startTutorial(data);
                break;

            case 'skip_tutorial':
                console.log('Received skip_tutorial, clearing tutorial');
                clearTutorialTimeouts();
                var loadingScreenForSkip = screens.loading;
                if (loadingScreenForSkip) {
                    loadingScreenForSkip.querySelector('.status').textContent = 'Loading Round 1...';
                }
                showScreen('loading');
                break;

            case 'loading':
                updateLoadingScreen(data);
                showScreen('loading');
                break;

            case 'loading_round':
                // Don't interrupt the tutorial with loading_round rebroadcasts
                if (tutorialRunning && currentScreen === 'tutorial') {
                    console.log('Tutorial running, ignoring loading_round');
                    break;
                }
                updateLoadingRoundScreen(data);
                showScreen('loading');
                break;

            case 'round_countdown':
                updateCountdownScreen(data);
                showScreen('countdown');
                break;

            case 'answering':
                updateAnsweringScreen(data);
                showScreen('answering');
                break;

            case 'voting_transition':
                showScreen('votingTransition');
                break;

            case 'matchup_voting':
                updateMatchupVotingScreen(data);
                showScreen('matchupVoting');
                break;

            case 'matchup_results':
                updateMatchupResultsScreen(data);
                showScreen('matchupResults');
                break;

            case 'round_results':
                updateRoundResultsScreen(data);
                showScreen('roundResults');
                break;

            case 'game_results':
                updateGameResultsScreen(data);
                showScreen('gameResults');
                break;

            case 'end':
                showScreen('end');
                break;

            default:
                console.warn('Unknown message type:', data.type);
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
}

/**
 * Update lobby screen with game and player info
 */
function updateLobbyScreen(data) {
    const screen = screens.lobby;

    screen.querySelector('.game-name').textContent = data.gameName;
    screen.querySelector('.host-name').textContent = data.hostName;
    screen.querySelector('.player-count').textContent = data.players.length + '/' + data.maxPlayers + ' players';
    screen.querySelector('.round-count').textContent = data.totalRounds + ' rounds';

    const playerList = screen.querySelector('.player-list');
    playerList.innerHTML = '';

    data.players.forEach(player => {
        playerList.appendChild(createPlayerCard(player));
    });
}

/**
 * Update loading screen for game start
 */
function updateLoadingScreen(data) {
    const screen = screens.loading;
    screen.querySelector('.status').textContent = 'Loading Game...';
}

/**
 * Update loading screen for round loading
 */
function updateLoadingRoundScreen(data) {
    const screen = screens.loading;
    screen.querySelector('.status').textContent = 'Loading Round ' + data.roundNumber + '...';
}

/**
 * Update countdown screen
 */
function updateCountdownScreen(data) {
    const screen = screens.countdown;

    screen.querySelector('.round-number').textContent = data.roundNumber;
    screen.querySelector('.countdown-number').textContent = data.secondsRemaining;
    screen.querySelector('.total-rounds').textContent = data.totalRounds;
}

/**
 * Update answering screen
 */
function updateAnsweringScreen(data) {
    const screen = screens.answering;

    screen.querySelector('.round-number').textContent = data.roundNumber;
    screen.querySelector('.timer-seconds').textContent = data.secondsRemaining;
    screen.querySelector('.answers-received').textContent = data.answersReceived;
    screen.querySelector('.total-players').textContent = data.totalPlayers;

    const timerCircle = screen.querySelector('.timer-circle');
    updateTimerStyle(timerCircle, data.secondsRemaining, 60);
}

/**
 * Update matchup voting screen
 */
function updateMatchupVotingScreen(data) {
    const screen = screens.matchupVoting;

    screen.querySelector('.prompt-text').textContent = data.promptText;
    screen.querySelector('.answer-1 .answer-text').textContent = data.answer1;
    screen.querySelector('.answer-2 .answer-text').textContent = data.answer2;
    screen.querySelector('.timer-seconds').textContent = data.secondsRemaining;
    screen.querySelector('.votes-received').textContent = data.votesReceived;
    screen.querySelector('.eligible-voters').textContent = data.eligibleVoters;
    screen.querySelector('.matchup-number').textContent = data.matchupNumber;
    screen.querySelector('.total-matchups').textContent = data.totalMatchups;
}

/**
 * Update matchup results screen
 */
function updateMatchupResultsScreen(data) {
    const screen = screens.matchupResults;

    screen.querySelector('.prompt-text').textContent = data.promptText;

    // Result 1
    const result1 = screen.querySelector('.result-1');
    result1.querySelector('.player-name').textContent = data.player1Name;
    result1.querySelector('.answer-text').textContent = data.answer1;
    result1.querySelector('.points').textContent = data.player1TotalPoints !== undefined ? data.player1TotalPoints : data.player1Votes;
    result1.querySelector('.votes').textContent = data.player1Votes;

    // Show/hide bonus line based on whether player gets the matchup bonus
    const bonusLine1 = result1.querySelector('.bonus-line');
    if (bonusLine1) {
        bonusLine1.style.display = data.player1GetsBonus ? 'block' : 'none';
    }

    const voters1 = result1.querySelector('.voter-icons');
    voters1.innerHTML = '';
    data.player1Voters.forEach(iconId => {
        voters1.appendChild(createVoterIcon(iconId));
    });

    // Result 2
    const result2 = screen.querySelector('.result-2');
    result2.querySelector('.player-name').textContent = data.player2Name;
    result2.querySelector('.answer-text').textContent = data.answer2;
    result2.querySelector('.points').textContent = data.player2TotalPoints !== undefined ? data.player2TotalPoints : data.player2Votes;
    result2.querySelector('.votes').textContent = data.player2Votes;

    // Show/hide bonus line based on whether player gets the matchup bonus
    const bonusLine2 = result2.querySelector('.bonus-line');
    if (bonusLine2) {
        bonusLine2.style.display = data.player2GetsBonus ? 'block' : 'none';
    }

    const voters2 = result2.querySelector('.voter-icons');
    voters2.innerHTML = '';
    data.player2Voters.forEach(iconId => {
        voters2.appendChild(createVoterIcon(iconId));
    });

    // Determine winner(s)
    result1.classList.remove('winner');
    result2.classList.remove('winner');

    const maxVotes = Math.max(data.player1Votes, data.player2Votes, data.abstainVoters.length);
    if (data.player1Votes === maxVotes) result1.classList.add('winner');
    if (data.player2Votes === maxVotes) result2.classList.add('winner');

    // Abstain voters
    const abstainSection = screen.querySelector('.abstain-section');
    const abstainIcons = screen.querySelector('.abstain-icons');
    abstainIcons.innerHTML = '';
    abstainSection.classList.remove('winner');

    if (data.abstainVoters && data.abstainVoters.length > 0) {
        abstainSection.style.display = 'flex';
        if (data.abstainVoters.length === maxVotes) {
            abstainSection.classList.add('winner');
        }
        data.abstainVoters.forEach(iconId => {
            abstainIcons.appendChild(createVoterIcon(iconId, true));
        });
    } else {
        abstainSection.style.display = 'none';
    }
}

// Track round results state for reordering animation
let roundResultsReorderTimeout = null;

/**
 * Update round results screen with reordering animation
 * Shows players sorted by round score first, then animates to total score order
 */
function updateRoundResultsScreen(data) {
    const screen = screens.roundResults;

    // Clear any pending reorder timeout from previous round
    if (roundResultsReorderTimeout) {
        clearTimeout(roundResultsReorderTimeout);
        roundResultsReorderTimeout = null;
    }

    screen.querySelector('.round-number').textContent = data.roundNumber;

    const leaderboard = screen.querySelector('.leaderboard');
    leaderboard.innerHTML = '';

    // Use compact layout when 6+ players so all entries fit on screen
    leaderboard.classList.toggle('compact', data.players.length >= 6);

    // Sort players by round score (descending), then total score, then alphabetical for initial display
    const sortedByRound = [...data.players].sort((a, b) => {
        if (b.roundScore !== a.roundScore) return b.roundScore - a.roundScore;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.name.localeCompare(b.name);
    });

    // Assign initial ranks based on round score
    let roundRank = 1;
    sortedByRound.forEach((player, index) => {
        if (index > 0 && sortedByRound[index - 1].roundScore > player.roundScore) {
            roundRank = index + 1;
        }
        player.displayRank = roundRank;
    });

    // Sort by total score, then round score, then alphabetical for final rankings
    const sortedByTotal = [...data.players].sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.roundScore !== a.roundScore) return b.roundScore - a.roundScore;
        return a.name.localeCompare(b.name);
    });

    // Assign final ranks based on total score
    let totalRank = 1;
    sortedByTotal.forEach((player, index) => {
        if (index > 0 && sortedByTotal[index - 1].totalScore > player.totalScore) {
            totalRank = index + 1;
        }
        player.finalRank = totalRank;
    });

    // Create a map of player name to their final position index in the sorted-by-total array
    const finalPositions = new Map();
    sortedByTotal.forEach((player, index) => {
        finalPositions.set(player.name, index);
    });

    // Initially show players sorted by round score
    sortedByRound.forEach((player, index) => {
        const entry = createLeaderboardEntry(player, true, false);

        // Find this player's final position
        const finalIndex = finalPositions.get(player.name);
        const finalRank = sortedByTotal[finalIndex].finalRank;

        // Store animation data
        entry.setAttribute('data-initial-index', index);
        entry.setAttribute('data-final-index', finalIndex);
        entry.setAttribute('data-final-rank', finalRank);
        entry.setAttribute('data-total-score', player.totalScore);

        leaderboard.appendChild(entry);
    });

    console.log('Round results: initial order by round score, will animate in 3s');

    // Reset the scores header for initial display
    const scoresHeaderContainer = screen.querySelector('.scores-header-container');
    if (scoresHeaderContainer) {
        scoresHeaderContainer.classList.remove('transitioned');
    }

    // After 3 seconds, animate to final positions sorted by total score
    roundResultsReorderTimeout = setTimeout(() => {
        console.log('Starting reorder animation');

        // Start crossfade: fade out "Round Scores" immediately
        if (scoresHeaderContainer) {
            scoresHeaderContainer.classList.add('transitioned');
        }

        const entries = Array.from(leaderboard.querySelectorAll('.leaderboard-entry'));
        if (entries.length === 0) {
            console.log('No entries found for animation');
            return;
        }

        // Calculate entry height including gap
        const firstEntry = entries[0];
        const secondEntry = entries[1];
        let entryHeight = 75; // default

        if (firstEntry && secondEntry) {
            const firstRect = firstEntry.getBoundingClientRect();
            const secondRect = secondEntry.getBoundingClientRect();
            entryHeight = secondRect.top - firstRect.top;
        } else if (firstEntry) {
            entryHeight = firstEntry.offsetHeight + 15; // estimate gap
        }

        console.log('Entry height calculated:', entryHeight);

        // Apply transforms to move entries to final positions
        entries.forEach((entry, i) => {
            const initialIndex = parseInt(entry.getAttribute('data-initial-index'));
            const finalIndex = parseInt(entry.getAttribute('data-final-index'));
            const finalRank = entry.getAttribute('data-final-rank');
            const moveDistance = (finalIndex - initialIndex) * entryHeight;

            console.log(`Player ${i}: initial=${initialIndex}, final=${finalIndex}, move=${moveDistance}px, finalRank=${finalRank}`);

            // Update the rank display
            const rankEl = entry.querySelector('.rank');
            if (rankEl) {
                rankEl.textContent = '#' + finalRank;
                // Update rank color class
                entry.className = entry.className.replace(/rank-\d+/g, '');
                entry.classList.add('rank-' + finalRank);
            }

            // Crossfade: fade out round score, fade in total score
            const roundScoreEl = entry.querySelector('.round-score');
            if (roundScoreEl) {
                roundScoreEl.style.opacity = '0';
            }
            const totalScoreReplace = entry.querySelector('.total-score-replace');
            if (totalScoreReplace) {
                totalScoreReplace.style.opacity = '1';
            }

            // Apply the transform animation
            entry.style.transition = 'transform 0.8s ease-in-out';
            entry.style.transform = `translateY(${moveDistance}px)`;
        });

        // After animation completes, reorder DOM elements to fix spacing
        setTimeout(() => {
            console.log('Animation complete, reordering DOM');

            // Sort entries by their final index
            const sortedEntries = entries.slice().sort((a, b) => {
                return parseInt(a.getAttribute('data-final-index')) - parseInt(b.getAttribute('data-final-index'));
            });

            // Remove transforms and reorder in DOM
            sortedEntries.forEach(entry => {
                entry.style.transition = 'none';
                entry.style.transform = 'none';
                leaderboard.appendChild(entry); // Re-appending moves to end, so doing in order reorders them
            });
        }, 850); // Slightly after the 0.8s animation

    }, 3000);
}

/**
 * Update game results screen
 */
function updateGameResultsScreen(data) {
    const screen = screens.gameResults;

    // Determine winner and loser ranks for badge display
    const topRank = Math.min(...data.players.map(p => p.rank));
    const bottomRank = Math.max(...data.players.map(p => p.rank));

    const leaderboard = screen.querySelector('.leaderboard');
    leaderboard.innerHTML = '';

    // Use compact layout when 6+ players so all entries fit on screen
    leaderboard.classList.toggle('compact', data.players.length >= 6);

    data.players.forEach(player => {
        // Determine badge: winner for top rank, half-wit for bottom rank
        let badge = null;
        if (player.rank === topRank) badge = 'winner';
        else if (player.rank === bottomRank) badge = 'halfwit';

        leaderboard.appendChild(createGameResultEntry(player, badge));
    });
}

/**
 * Create a game result entry with optional winner/half-wit badge
 */
function createGameResultEntry(player, badge) {
    const entry = document.createElement('div');
    entry.className = 'leaderboard-entry rank-' + player.rank;
    entry.setAttribute('data-player-id', player.peerId || player.name);

    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = '#' + player.rank;

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.appendChild(createIconImg(player.iconId));

    const info = document.createElement('div');
    info.className = 'player-info';

    const nameRow = document.createElement('div');
    nameRow.className = 'name-badge-row';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = player.name;
    nameRow.appendChild(name);

    if (badge) {
        const badgeImg = document.createElement('img');
        badgeImg.className = 'result-badge';
        badgeImg.src = badge === 'winner' ? 'halfwit_winner.png' : 'halfwit_loser.png';
        badgeImg.alt = badge === 'winner' ? 'Winner' : 'Half-Wit';
        nameRow.appendChild(badgeImg);
    }

    info.appendChild(nameRow);

    const scoreSection = document.createElement('div');
    scoreSection.className = 'score-section';

    const totalScore = document.createElement('div');
    totalScore.className = 'total-score highlighted';
    const points = player.totalScore === 1 ? 'Pt' : 'Pts';
    totalScore.textContent = player.totalScore + ' ' + points;
    scoreSection.appendChild(totalScore);

    entry.appendChild(rank);
    entry.appendChild(icon);
    entry.appendChild(info);
    entry.appendChild(scoreSection);

    return entry;
}

// ==================== Tutorial Animation ====================

// Track tutorial state to prevent duplicate runs
let tutorialRunning = false;
let tutorialTimeouts = [];

/**
 * Clear all pending tutorial timeouts
 */
function clearTutorialTimeouts() {
    tutorialTimeouts.forEach(id => clearTimeout(id));
    tutorialTimeouts = [];
    tutorialRunning = false;
}

/**
 * Schedule a timeout and track it for cleanup
 */
function tutorialTimeout(fn, delay) {
    const id = setTimeout(fn, delay);
    tutorialTimeouts.push(id);
    return id;
}

/**
 * Show a tutorial step with fade animation
 */
function showTutorialStep(stepNumber) {
    // Hide all steps
    for (let i = 1; i <= 7; i++) {
        const step = document.getElementById('tutorial-step-' + i);
        if (step) {
            step.classList.remove('active', 'fade-in');
            if (i !== stepNumber) {
                step.classList.add('fade-out');
            }
        }
    }

    // Show the target step
    tutorialTimeout(() => {
        for (let i = 1; i <= 7; i++) {
            const step = document.getElementById('tutorial-step-' + i);
            if (step) {
                step.classList.remove('active', 'fade-in', 'fade-out');
                step.style.display = 'none';
            }
        }
        const target = document.getElementById('tutorial-step-' + stepNumber);
        if (target) {
            target.style.display = 'flex';
            target.classList.add('active', 'fade-in');
        }
    }, 300); // Wait for fade-out to complete
}

/**
 * Typewriter effect - types text character by character
 */
function typeText(element, text, msPerChar, callback) {
    let index = 0;
    function typeNext() {
        if (index < text.length) {
            element.textContent += text[index];
            index++;
            tutorialTimeout(typeNext, msPerChar);
        } else if (callback) {
            callback();
        }
    }
    typeNext();
}

/**
 * Start the tutorial animation sequence
 * Matches Android TutorialScreen.kt timing as closely as possible
 */
function startTutorial(data) {
    // If tutorial is already running, ignore duplicate messages
    if (tutorialRunning && currentScreen === 'tutorial') {
        console.log('Tutorial already running, ignoring duplicate');
        return;
    }

    // Clear any previous tutorial
    clearTutorialTimeouts();
    tutorialRunning = true;

    const totalRounds = data.totalRounds || 3;
    const answerTimeSeconds = data.answerTimeSeconds || 60;

    // Format time label
    let timeLabel;
    if (answerTimeSeconds === 60) {
        timeLabel = '1 Minute';
    } else {
        timeLabel = answerTimeSeconds + ' Second';
    }

    // Reset all tutorial step elements
    for (let i = 1; i <= 7; i++) {
        const step = document.getElementById('tutorial-step-' + i);
        if (step) {
            step.style.display = 'none';
            step.classList.remove('active', 'fade-in', 'fade-out');
        }
    }

    // Reset step 3: rounds number
    const roundsNum = document.querySelector('.tutorial-rounds-number');
    if (roundsNum) roundsNum.textContent = totalRounds;

    // Reset step 4: demo elements
    const timeEl = document.getElementById('tutorial-time-label');
    if (timeEl) timeEl.textContent = timeLabel;

    const prompt1 = document.getElementById('tutorial-prompt-1');
    const prompt2 = document.getElementById('tutorial-prompt-2');
    if (prompt1) {
        prompt1.classList.remove('visible');
        prompt1.querySelector('.tutorial-prompt-label').textContent = '';
        const tf1 = prompt1.querySelector('.tutorial-text-field');
        tf1.classList.remove('has-text');
        tf1.querySelector('.tutorial-typed-text').textContent = '';
    }
    if (prompt2) {
        prompt2.classList.remove('visible');
        prompt2.querySelector('.tutorial-prompt-label').textContent = '';
        const tf2 = prompt2.querySelector('.tutorial-text-field');
        tf2.classList.remove('has-text');
        tf2.querySelector('.tutorial-typed-text').textContent = '';
    }

    const submitBtn = document.getElementById('tutorial-submit-btn');
    if (submitBtn) {
        submitBtn.classList.remove('visible', 'enabled', 'submitted');
    }
    const submittedText = document.getElementById('tutorial-submitted-text');
    if (submittedText) submittedText.classList.remove('visible');

    // Reset step 5: VS cards
    const vsPink = document.getElementById('tutorial-vs-pink');
    const vsText = document.getElementById('tutorial-vs-text');
    const vsGreen = document.getElementById('tutorial-vs-green');
    if (vsPink) vsPink.classList.remove('visible');
    if (vsText) vsText.classList.remove('visible');
    if (vsGreen) vsGreen.classList.remove('visible');

    // Reset step 6: earn points + bonus + remember
    const plusOne = document.getElementById('tutorial-plus-one');
    if (plusOne) plusOne.classList.remove('float-in', 'float-out');
    const bonusText = document.getElementById('tutorial-bonus-text');
    if (bonusText) bonusText.classList.remove('visible');
    const plusOneBonus = document.getElementById('tutorial-plus-one-bonus');
    if (plusOneBonus) plusOneBonus.classList.remove('float-in', 'float-out');
    const remember = document.getElementById('tutorial-remember');
    if (remember) remember.classList.remove('visible', 'shaking');

    // Show the tutorial screen
    showScreen('tutorial');

    // Timeline offset tracker
    let t = 0;

    // ===== Step 1: Welcome (0.0s – 1.75s) =====
    const step1 = document.getElementById('tutorial-step-1');
    step1.style.display = 'flex';
    step1.classList.add('active', 'fade-in');
    t += 1750;

    // ===== Step 2: Here's How it Works (1.75s – 3.5s) =====
    tutorialTimeout(() => showTutorialStep(2), t);
    t += 1750;

    // ===== Step 3: X Rounds (3.5s – 5.5s) =====
    tutorialTimeout(() => showTutorialStep(3), t);
    t += 2000;

    // ===== Step 4: Prompts + Answering Demo (5.5s – ~15.0s) =====
    tutorialTimeout(() => showTutorialStep(4), t);
    const step4Start = t;
    t += 2000; // Text appears, 2s before demo starts

    // Show prompt cards (slide in)
    tutorialTimeout(() => {
        const p1 = document.getElementById('tutorial-prompt-1');
        if (p1) p1.classList.add('visible');
    }, t);
    t += 200;

    tutorialTimeout(() => {
        const p2 = document.getElementById('tutorial-prompt-2');
        if (p2) p2.classList.add('visible');
    }, t);
    t += 500;

    // Show submit button (disabled)
    tutorialTimeout(() => {
        const btn = document.getElementById('tutorial-submit-btn');
        if (btn) btn.classList.add('visible');
    }, t);

    // Type "Prompt 1" into card 1 label
    tutorialTimeout(() => {
        const label = document.querySelector('#tutorial-prompt-1 .tutorial-prompt-label');
        if (label) typeText(label, 'Prompt 1', 60);
    }, t);
    t += 480 + 150; // 8 chars * 60ms + 150ms gap

    // Type "Prompt 2" into card 2 label
    tutorialTimeout(() => {
        const label = document.querySelector('#tutorial-prompt-2 .tutorial-prompt-label');
        if (label) typeText(label, 'Prompt 2', 60);
    }, t);
    t += 480 + 150;

    // Type answer 1: "A clever answer!"
    tutorialTimeout(() => {
        const tf = document.querySelector('#tutorial-prompt-1 .tutorial-text-field');
        const typed = document.querySelector('#tutorial-prompt-1 .tutorial-typed-text');
        if (tf && typed) {
            tf.classList.add('has-text');
            typeText(typed, 'A clever answer!', 55);
        }
    }, t);
    t += 16 * 55 + 150; // 16 chars * 55ms + gap

    // Type answer 2: "A witty response!"
    tutorialTimeout(() => {
        const tf = document.querySelector('#tutorial-prompt-2 .tutorial-text-field');
        const typed = document.querySelector('#tutorial-prompt-2 .tutorial-typed-text');
        if (tf && typed) {
            tf.classList.add('has-text');
            typeText(typed, 'A witty response!', 55);
        }
    }, t);
    t += 17 * 55 + 200; // 17 chars * 55ms + gap

    // Button enables (gray → pink)
    tutorialTimeout(() => {
        const btn = document.getElementById('tutorial-submit-btn');
        if (btn) btn.classList.add('enabled');
    }, t);
    t += 500;

    // Button pressed (pink → green)
    tutorialTimeout(() => {
        const btn = document.getElementById('tutorial-submit-btn');
        if (btn) {
            btn.classList.remove('enabled');
            btn.classList.add('submitted');
        }
    }, t);
    t += 500;

    // Show "Submitted!" text
    tutorialTimeout(() => {
        const st = document.getElementById('tutorial-submitted-text');
        if (st) st.classList.add('visible');
    }, t);
    t += 700;

    // Hold + fade out gap
    t += 400;

    // ===== Step 5: Matched Up (horizontal cards) =====
    tutorialTimeout(() => showTutorialStep(5), t);
    t += 1000 + 300; // 1s for text to appear + fade transition time

    // Pink card flies in from left
    tutorialTimeout(() => {
        const card = document.getElementById('tutorial-vs-pink');
        if (card) card.classList.add('visible');
    }, t);
    t += 600;

    // "VS" appears
    tutorialTimeout(() => {
        const vs = document.getElementById('tutorial-vs-text');
        if (vs) vs.classList.add('visible');
    }, t);
    t += 500;

    // Green card flies in from right
    tutorialTimeout(() => {
        const card = document.getElementById('tutorial-vs-green');
        if (card) card.classList.add('visible');
    }, t);
    t += 2600; // Hold for viewing

    // ===== Step 6: Earn Points + Bonus + Remember =====
    tutorialTimeout(() => showTutorialStep(6), t);
    t += 750; // Earn points text appears

    // First +1 floats in
    tutorialTimeout(() => {
        const p1 = document.getElementById('tutorial-plus-one');
        if (p1) p1.classList.add('float-in');
    }, t);
    t += 1000;

    // First +1 floats out
    tutorialTimeout(() => {
        const p1 = document.getElementById('tutorial-plus-one');
        if (p1) {
            p1.classList.remove('float-in');
            p1.classList.add('float-out');
        }
    }, t);
    t += 500;

    // Bonus text fades in
    tutorialTimeout(() => {
        const bt = document.getElementById('tutorial-bonus-text');
        if (bt) bt.classList.add('visible');
    }, t);
    t += 750;

    // Second +1 (bonus) floats in
    tutorialTimeout(() => {
        const p2 = document.getElementById('tutorial-plus-one-bonus');
        if (p2) p2.classList.add('float-in');
    }, t);
    t += 1000;

    // Second +1 (bonus) floats out
    tutorialTimeout(() => {
        const p2 = document.getElementById('tutorial-plus-one-bonus');
        if (p2) {
            p2.classList.remove('float-in');
            p2.classList.add('float-out');
        }
    }, t);
    t += 500;

    // Remember text appears with shake
    tutorialTimeout(() => {
        const rem = document.getElementById('tutorial-remember');
        if (rem) {
            rem.classList.add('visible', 'shaking');
        }
    }, t);
    t += 3750; // Hold for reading

    // ===== Step 7: Get Ready! =====
    tutorialTimeout(() => showTutorialStep(7), t);
    t += 3000;

    // Tutorial complete - show loading screen as fallback
    tutorialTimeout(() => {
        tutorialRunning = false;
        console.log('Tutorial animation complete');
        // Show loading screen with spinner while waiting for next phase
        const loadingScreen = screens.loading;
        if (loadingScreen) {
            loadingScreen.querySelector('.status').textContent = 'Loading Round 1...';
        }
        showScreen('loading');
    }, t);

    console.log('Tutorial started, total duration: ' + t + 'ms');
}

/**
 * Initialize the Cast Receiver
 */
function initReceiver() {
    console.log('Initializing Half-Wit Cast Receiver');

    const context = cast.framework.CastReceiverContext.getInstance();
    const options = new cast.framework.CastReceiverOptions();

    // Disable default media playback UI
    options.disableIdleTimeout = true;

    // Set up custom message listener
    context.addCustomMessageListener(HALFWIT_NAMESPACE, (event) => {
        console.log('Custom message received:', event);
        if (event.data) {
            handleMessage(typeof event.data === 'string' ? event.data : JSON.stringify(event.data));
        }
    });

    // Handle sender connected — notify sender that receiver is ready for messages
    context.addEventListener(cast.framework.system.EventType.SENDER_CONNECTED, (event) => {
        console.log('Sender connected:', event);
        // Send ready acknowledgment so sender knows receiver is listening
        context.sendCustomMessage(HALFWIT_NAMESPACE, event.senderId, JSON.stringify({ type: 'receiver_ready' }));
        console.log('Sent receiver_ready to sender:', event.senderId);
    });

    // Handle sender disconnected
    context.addEventListener(cast.framework.system.EventType.SENDER_DISCONNECTED, (event) => {
        console.log('Sender disconnected:', event);
        // If no more senders, show end screen
        if (context.getSenders().length === 0) {
            showScreen('end');
        }
    });

    // Start the receiver
    context.start(options);

    console.log('Cast Receiver started');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReceiver);
} else {
    initReceiver();
}
