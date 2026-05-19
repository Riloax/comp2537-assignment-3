// ── Difficulty settings ──
const DIFFICULTY = {
  easy: { pairs: 3, time: 60 },
  medium: { pairs: 6, time: 90 },
  hard: { pairs: 10, time: 120 },
};

// Game state
let clickCount = 0;
let pairsMatched = 0;
let totalPairs = 0;
let timeLeft = 0;
let timerID = null;
let gameActive = false;
let currentDiff = "easy";
let powerupUsed = false;
let allPokemon = []; // cached list from API

function setup() {
  firstCard = undefined;
  secondCard = undefined;

  $(".card").on("click", function () {
    if (!gameActive) return; // game not started
    if (lockBoard) return; // two cards already flipping
    if ($(this).hasClass("flip")) return; // same card clicked twice
    if ($(this).hasClass("matched")) return; // already matched

    $(this).toggleClass("flip");
    clickCount++;
    updateStatus();

    if (!firstCard) firstCard = $(this).find(".front_face")[0];
    else {
      secondCard = $(this).find(".front_face")[0];
      console.log(firstCard, secondCard);

      lockBoard = true; // prevent more clicks while checking

      if (firstCard.src === secondCard.src) {
        //  Match
        console.log("match");
        $(`#${firstCard.id}`).closest(".card").addClass("matched").off("click");
        $(`#${secondCard.id}`)
          .closest(".card")
          .addClass("matched")
          .off("click");
        pairsMatched++;
        updateStatus();
        resetTurn();
        if (pairsMatched === totalPairs) {
          setTimeout(winGame, 500);
        }
      } else {
        // No match
        console.log("no match");
        const fc = firstCard;
        const sc = secondCard;
        setTimeout(() => {
          $(`#${fc.id}`).closest(".card").toggleClass("flip");
          $(`#${sc.id}`).closest(".card").toggleClass("flip");
          resetTurn();
        }, 1000);
      }
    }
  });
}

// Helpers that were implicit in the starters
let firstCard = undefined;
let secondCard = undefined;
let lockBoard = false;

function resetTurn() {
  firstCard = undefined;
  secondCard = undefined;
  lockBoard = false;
}

$(document).ready(function () {
  // ── Difficulty buttons ──
  $(".diff_btn").on("click", function () {
    $(".diff_btn").removeClass("active");
    $(this).addClass("active");
    currentDiff = $(this).data("diff");
  });

  // ── Start button ──
  $("#start_btn").on("click", startGame);

  // ── Reset button ──
  $("#reset_btn").on("click", resetGame);

  // ── Power-up button ──
  $("#powerup_btn").on("click", activatePowerup);

  // ── Theme buttons ──
  $(".theme_btn").on("click", function () {
    const theme = $(this).data("theme");
    $("body").removeClass("dark light").addClass(theme);
    $(".theme_btn").removeClass("active");
    $(this).addClass("active");
  });

  // ── Overlay play-again button ──
  $("#overlay_btn").on("click", function () {
    $("#overlay").addClass("hidden");
    resetGame();
  });

  updateStatus();
});

// ================================================
//  POKEMON API
// ================================================
async function fetchAllPokemon() {
  if (allPokemon.length > 0) return allPokemon;
  const resp = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");
  const data = await resp.json();
  allPokemon = data.results;
  return allPokemon;
}

async function fetchRandomPokemon(count) {
  const list = await fetchAllPokemon();
  // Shuffle and take 'count' unique entries
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  const results = await Promise.all(
    selected.map(async (p) => {
      const resp = await fetch(p.url);
      const data = await resp.json();
      // Use official artwork as instructed; fall back to front_default
      const img =
        data.sprites?.other?.["official-artwork"]?.front_default ||
        data.sprites?.front_default ||
        "";
      return { name: data.name, img, id: data.id };
    }),
  );
  return results.filter((p) => p.img);
}

//  START GAME
async function startGame() {
  stopTimer();
  $("#overlay").addClass("hidden");
  $("#loading").removeClass("hidden");

  // Reset state
  const settings = DIFFICULTY[currentDiff];
  totalPairs = settings.pairs;
  timeLeft = settings.time;
  clickCount = 0;
  pairsMatched = 0;
  firstCard = undefined;
  secondCard = undefined;
  lockBoard = false;
  powerupUsed = false;
  gameActive = true;
  $("#powerup_btn").prop("disabled", false).text("⚡ Peek");
  updateStatus();

  try {
    const pokemon = await fetchRandomPokemon(totalPairs);
    buildGrid(pokemon);
    $("#loading").addClass("hidden");
    setup();
    startTimer();
  } catch (e) {
    console.error(e);
    $("#loading").addClass("hidden");
    alert("Could not load Pokémon. Check your connection and try again.");
  }
}
// Builds the card grid based on the selected pokémon
function buildGrid(pokemon) {
  const grid = $("#game_grid");
  grid.empty();
  grid.removeClass("grid_easy grid_medium grid_hard");
  grid.addClass("grid_" + currentDiff);

  // Duplicate each pokémon to make a pair, then shuffle
  const pairs = [...pokemon, ...pokemon].sort(() => Math.random() - 0.5);

  pairs.forEach((poke, idx) => {
    const card = $(`
      <div class="card">
        <img id="img${idx}" class="front_face" src="${poke.img}" alt="${poke.name}">
        <img class="back_face" src="back.webp" alt="">
      </div>
    `);
    grid.append(card);
  });
}

//  TIMER
function startTimer() {
  updateTimerDisplay();
  timerID = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      stopTimer();
      loseGame();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerID);
  timerID = null;
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const str = m + ":" + String(s).padStart(2, "0");
  $("#timer_display").text(str);
  if (timeLeft <= 10 && timeLeft > 0) {
    $("#timer_display").addClass("urgent");
  } else {
    $("#timer_display").removeClass("urgent");
  }
}

// ================================================
//  STATUS UPDATE
// ================================================
function updateStatus() {
  $("#click_count").text(clickCount);
  $("#pairs_matched").text(pairsMatched);
  $("#total_pairs").text(totalPairs);
  $("#pairs_left").text(totalPairs - pairsMatched);
  if (!gameActive) $("#timer_display").text("--");
}

// ================================================
//  WIN / LOSE
// ================================================
function winGame() {
  stopTimer();
  gameActive = false;
  lockBoard = true;
  $("#powerup_btn").prop("disabled", true);

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  showOverlay(
    "🏆",
    "You Win!",
    `All ${totalPairs} pairs matched in ${clickCount} clicks with ${m}:${String(s).padStart(2, "0")} to spare!`,
  );
}

function loseGame() {
  gameActive = false;
  lockBoard = true;
  $(".card").off("click");
  $("#powerup_btn").prop("disabled", true);

  showOverlay(
    "😞",
    "Game Over!",
    `Time's up! You matched ${pairsMatched} of ${totalPairs} pairs. Give it another shot!`,
  );
}

function showOverlay(icon, title, msg) {
  $("#overlay_icon").text(icon);
  $("#overlay_title").text(title);
  $("#overlay_msg").text(msg);
  $("#overlay").removeClass("hidden");
}

// ================================================
//  RESET
// ================================================
function resetGame() {
  stopTimer();
  gameActive = false;
  firstCard = undefined;
  secondCard = undefined;
  lockBoard = false;
  clickCount = 0;
  pairsMatched = 0;
  totalPairs = 0;
  timeLeft = 0;
  powerupUsed = false;

  $("#game_grid").empty().removeClass("grid_easy grid_medium grid_hard");
  $("#overlay").addClass("hidden");
  $("#powerup_btn").prop("disabled", true).text("⚡ Peek");
  updateStatus();
}

// ================================================
//  POWER-UP: Peek — shows all cards for 3 seconds
// ================================================
function activatePowerup() {
  if (powerupUsed || !gameActive) return;
  powerupUsed = true;
  lockBoard = true;
  $("#powerup_btn").prop("disabled", true).text("⚡ Used!");

  // Temporarily flip all unmatched cards face-up
  $(".card:not(.matched)").addClass("flip");

  setTimeout(() => {
    // Flip back only the ones that weren't already flipped by the player
    $(".card:not(.matched)").removeClass("flip");
    // Give the flip animation time to finish before unlocking
    setTimeout(() => {
      lockBoard = false;
    }, 1000);
  }, 3000);
}
