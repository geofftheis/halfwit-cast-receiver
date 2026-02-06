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

/**
 * Parse emojis in an element using Twemoji (renders as images)
 * This ensures emojis display correctly on Chromecast devices
 */
function parseEmojis(element) {
    if (typeof twemoji !== 'undefined') {
        try {
            twemoji.parse(element, {
                folder: 'svg',
                ext: '.svg',
                base: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/'
            });
        } catch (e) {
            console.error('Twemoji parse error:', e);
        }
    } else {
        console.warn('Twemoji not loaded');
    }
}

/**
 * Create a player card element
 */
function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card' + (player.isHost ? ' host' : '');

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = player.iconId;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = player.name;

    card.appendChild(icon);
    card.appendChild(name);

    // Parse emojis to render as images
    parseEmojis(icon);

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
    icon.textContent = player.iconId;

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
    }

    // Smaller total score below (e.g., "Total Score: 6 Points")
    const totalScore = document.createElement('div');
    totalScore.className = 'total-score' + (highlightTotalScore ? ' highlighted' : '');
    const points = player.totalScore === 1 ? 'Point' : 'Points';
    totalScore.textContent = 'Total Score: ' + player.totalScore + ' ' + points;
    scoreSection.appendChild(totalScore);

    entry.appendChild(rank);
    entry.appendChild(icon);
    entry.appendChild(info);
    entry.appendChild(scoreSection);

    // Parse emojis to render as images
    parseEmojis(icon);

    return entry;
}

/**
 * Create a voter icon element
 */
function createVoterIcon(iconId, isAbstain = false) {
    const icon = document.createElement('span');
    icon.className = isAbstain ? 'abstain-icon' : 'voter-icon';
    icon.textContent = iconId;
    // Parse emojis to render as images
    parseEmojis(icon);
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

            case 'loading':
                updateLoadingScreen(data);
                showScreen('loading');
                break;

            case 'loading_round':
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

    const scoringStyle = data.scoringStyle || 'POINTS_PER_VOTE';
    const showBreakdown = scoringStyle === 'VOTES_PLUS_BONUS';

    // Result 1
    const result1 = screen.querySelector('.result-1');
    result1.querySelector('.player-name').textContent = data.player1Name;
    result1.querySelector('.answer-text').textContent = data.answer1;
    result1.querySelector('.points').textContent = data.player1TotalPoints !== undefined ? data.player1TotalPoints : data.player1Votes;
    result1.querySelector('.votes').textContent = data.player1Votes;

    // Show/hide score breakdown based on scoring style
    const breakdown1 = result1.querySelector('.score-breakdown');
    if (breakdown1) {
        breakdown1.style.display = showBreakdown ? 'block' : 'none';
        const bonusLine1 = breakdown1.querySelector('.bonus-line');
        if (bonusLine1) {
            bonusLine1.style.display = data.player1GetsBonus ? 'block' : 'none';
        }
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

    // Show/hide score breakdown based on scoring style
    const breakdown2 = result2.querySelector('.score-breakdown');
    if (breakdown2) {
        breakdown2.style.display = showBreakdown ? 'block' : 'none';
        const bonusLine2 = breakdown2.querySelector('.bonus-line');
        if (bonusLine2) {
            bonusLine2.style.display = data.player2GetsBonus ? 'block' : 'none';
        }
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

    if (data.abstainVoters && data.abstainVoters.length > 0) {
        abstainSection.style.display = 'flex';
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

    // Sort players by round score (descending) for initial display
    const sortedByRound = [...data.players].sort((a, b) => b.roundScore - a.roundScore);

    // Assign initial ranks based on round score
    let roundRank = 1;
    sortedByRound.forEach((player, index) => {
        if (index > 0 && sortedByRound[index - 1].roundScore > player.roundScore) {
            roundRank = index + 1;
        }
        player.displayRank = roundRank;
    });

    // Sort by total score to get final rankings
    const sortedByTotal = [...data.players].sort((a, b) => b.totalScore - a.totalScore);

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

        leaderboard.appendChild(entry);
    });

    console.log('Round results: initial order by round score, will animate in 3s');

    // After 3 seconds, animate to final positions sorted by total score
    roundResultsReorderTimeout = setTimeout(() => {
        console.log('Starting reorder animation');

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

            // Highlight the total score (make it pink and larger)
            const totalScoreEl = entry.querySelector('.total-score');
            if (totalScoreEl) {
                totalScoreEl.classList.add('highlighted');
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

    // Update winner names
    const winnerNames = screen.querySelector('.winner-names');
    if (winnerNames) {
        winnerNames.textContent = data.winnerName;
    }

    // Update winner emoji (trophy for single winner, handshake for tie)
    const winnerEmoji = screen.querySelector('.winner-emoji');
    if (winnerEmoji) {
        winnerEmoji.textContent = data.isTie ? '🤝' : '🏆';
        parseEmojis(winnerEmoji);
    }

    // Update loser names (player(s) with lowest score)
    const loserNames = screen.querySelector('.loser-names');
    if (loserNames) {
        loserNames.textContent = data.loserName || '';
    }

    // Update loser emoji (sad face)
    const loserEmoji = screen.querySelector('.loser-emoji');
    if (loserEmoji) {
        loserEmoji.textContent = '😢';
        parseEmojis(loserEmoji);
    }

    const leaderboard = screen.querySelector('.leaderboard');
    leaderboard.innerHTML = '';

    data.players.forEach(player => {
        // On final results, don't show round score but highlight total score in pink
        leaderboard.appendChild(createLeaderboardEntry(player, false, true));
    });
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

    // Handle sender connected
    context.addEventListener(cast.framework.system.EventType.SENDER_CONNECTED, (event) => {
        console.log('Sender connected:', event);
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
