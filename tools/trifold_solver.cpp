#include <algorithm>
#include <array>
#include <cstdint>
#include <iostream>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

enum class TargetKind { Tableau, FreeCell, Foundation };
enum class SourceKind { Tableau, FreeCell };
enum class ActionKind { Move, CollectDragons };

struct Action {
  ActionKind kind = ActionKind::Move;
  SourceKind sourceKind = SourceKind::Tableau;
  int sourceIndex = -1;
  int card = -1;
  TargetKind targetKind = TargetKind::Tableau;
  int targetIndex = -1;
  int family = -1;
};

struct State {
  std::array<std::vector<int>, 8> tableau;
  // -1 empty, >=0 physical card, -2/-3/-4 collected red/green/white family.
  std::array<int, 3> freeCells{{-1, -1, -1}};
  std::array<int, 3> foundations{{0, 0, 0}};
  bool flower = false;
};

static uint32_t next_u32(uint32_t& state) {
  uint32_t x = state;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  state = x;
  return state;
}

static bool is_number(int card) { return card >= 0 && card < 27; }
static int suit_of(int card) { return is_number(card) ? card / 9 : -1; }
static int rank_of(int card) { return is_number(card) ? (card % 9) + 1 : -1; }
static bool is_dragon(int card) { return card >= 27 && card < 39; }
static int family_of(int card) { return is_dragon(card) ? (card - 27) / 4 : -1; }
static bool is_flower(int card) { return card == 39; }

static std::string suit_name(int suit) {
  static const std::array<const char*, 3> names{{"coins", "bamboo", "characters"}};
  return names.at(static_cast<size_t>(suit));
}

static std::string family_name(int family) {
  static const std::array<const char*, 3> names{{"red", "green", "white"}};
  return names.at(static_cast<size_t>(family));
}

static std::string card_id(int card) {
  if (is_number(card)) return suit_name(suit_of(card)) + "-" + std::to_string(rank_of(card));
  if (is_dragon(card)) return "dragon-" + family_name(family_of(card)) + "-" + std::to_string(((card - 27) % 4) + 1);
  if (is_flower(card)) return "flower";
  throw std::runtime_error("invalid card id");
}

static std::vector<int> create_deck() {
  std::vector<int> deck(40);
  for (int index = 0; index < 40; ++index) deck[static_cast<size_t>(index)] = index;
  return deck;
}

static State create_deal(uint32_t seed) {
  auto deck = create_deck();
  uint32_t rng = seed;
  for (int index = static_cast<int>(deck.size()) - 1; index > 0; --index) {
    const uint32_t swap_index = next_u32(rng) % static_cast<uint32_t>(index + 1);
    std::swap(deck[static_cast<size_t>(index)], deck[swap_index]);
  }
  State state;
  for (int row = 0; row < 5; ++row) {
    for (int column = 0; column < 8; ++column) {
      state.tableau[static_cast<size_t>(column)].push_back(deck[static_cast<size_t>(row * 8 + column)]);
    }
  }
  return state;
}

static void print_deal_json(uint32_t seed) {
  const State state = create_deal(seed);
  std::cout << "{\"seed\":" << seed << ",\"tableau\":[";
  for (size_t c = 0; c < state.tableau.size(); ++c) {
    if (c) std::cout << ',';
    std::cout << '[';
    for (size_t i = 0; i < state.tableau[c].size(); ++i) {
      if (i) std::cout << ',';
      std::cout << '"' << card_id(state.tableau[c][i]) << '"';
    }
    std::cout << ']';
  }
  std::cout << "]}\n";
}

static bool family_done(const State& state, int family) {
  const int marker = -(family + 2);
  return std::find(state.freeCells.begin(), state.freeCells.end(), marker) != state.freeCells.end();
}

static bool won(const State& state) {
  return state.flower
    && state.foundations[0] == 9 && state.foundations[1] == 9 && state.foundations[2] == 9
    && family_done(state, 0) && family_done(state, 1) && family_done(state, 2);
}

static int minimum_foundation(const State& state) {
  return std::min({state.foundations[0], state.foundations[1], state.foundations[2]});
}

static bool safe_auto_number(const State& state, int card) {
  if (!is_number(card)) return false;
  const int suit = suit_of(card);
  const int rank = rank_of(card);
  return rank == state.foundations[static_cast<size_t>(suit)] + 1 && minimum_foundation(state) >= rank - 1;
}

static bool normalize(State& state) {
  bool changed = false;
  for (int step = 0; step < 40; ++step) {
    if (!state.flower) {
      bool moved = false;
      for (int column = 0; column < 8; ++column) {
        auto& cards = state.tableau[static_cast<size_t>(column)];
        if (!cards.empty() && is_flower(cards.back())) {
          cards.pop_back();
          state.flower = true;
          changed = moved = true;
          break;
        }
      }
      if (!moved) {
        for (int cell = 0; cell < 3; ++cell) {
          if (is_flower(state.freeCells[static_cast<size_t>(cell)])) {
            state.freeCells[static_cast<size_t>(cell)] = -1;
            state.flower = true;
            changed = moved = true;
            break;
          }
        }
      }
      if (moved) continue;
    }

    struct Candidate { int card; bool fromFree; int sourceIndex; int sourceOrder; };
    std::optional<Candidate> best;
    auto better = [](const Candidate& a, const Candidate& b) {
      const int ar = rank_of(a.card), br = rank_of(b.card);
      if (ar != br) return ar < br;
      const int as = suit_of(a.card), bs = suit_of(b.card);
      if (as != bs) return as < bs;
      return a.sourceOrder < b.sourceOrder;
    };

    for (int column = 0; column < 8; ++column) {
      const auto& cards = state.tableau[static_cast<size_t>(column)];
      if (!cards.empty() && safe_auto_number(state, cards.back())) {
        Candidate candidate{cards.back(), false, column, column};
        if (!best || better(candidate, *best)) best = candidate;
      }
    }
    for (int cell = 0; cell < 3; ++cell) {
      const int card = state.freeCells[static_cast<size_t>(cell)];
      if (card >= 0 && safe_auto_number(state, card)) {
        Candidate candidate{card, true, cell, 8 + cell};
        if (!best || better(candidate, *best)) best = candidate;
      }
    }
    if (!best) return changed;

    const int card = best->card;
    if (best->fromFree) state.freeCells[static_cast<size_t>(best->sourceIndex)] = -1;
    else state.tableau[static_cast<size_t>(best->sourceIndex)].pop_back();
    state.foundations[static_cast<size_t>(suit_of(card))] += 1;
    changed = true;
  }
  throw std::runtime_error("automatic normalization exceeded 40 moves");
}

static bool valid_run_suffix(const std::vector<int>& cards, int start) {
  if (start < 0 || start >= static_cast<int>(cards.size())) return false;
  if (start == static_cast<int>(cards.size()) - 1) return true;
  for (int index = start; index + 1 < static_cast<int>(cards.size()); ++index) {
    const int lower = cards[static_cast<size_t>(index)];
    const int upper = cards[static_cast<size_t>(index + 1)];
    if (!is_number(lower) || !is_number(upper)) return false;
    if (rank_of(upper) != rank_of(lower) - 1 || suit_of(upper) == suit_of(lower)) return false;
  }
  return true;
}

static bool can_stack_on(int root, int target) {
  return is_number(root) && is_number(target)
    && rank_of(root) == rank_of(target) - 1
    && suit_of(root) != suit_of(target);
}

static std::string state_key(const State& state) {
  std::array<std::vector<int>, 8> sortedColumns = state.tableau;
  std::sort(sortedColumns.begin(), sortedColumns.end());
  std::string key;
  key.reserve(64);
  for (const auto& column : sortedColumns) {
    key.push_back(static_cast<char>(column.size()));
    for (const int card : column) key.push_back(static_cast<char>(card + 1));
  }
  key.push_back(static_cast<char>(0x7f));
  for (int cell : state.freeCells) key.push_back(static_cast<char>(cell + 6));
  for (int foundation : state.foundations) key.push_back(static_cast<char>(foundation));
  key.push_back(static_cast<char>(state.flower ? 1 : 0));
  return key;
}

static int first_empty_free(const State& state) {
  for (int cell = 0; cell < 3; ++cell) if (state.freeCells[static_cast<size_t>(cell)] == -1) return cell;
  return -1;
}

static int first_empty_tableau_except(const State& state, int sourceColumn) {
  for (int column = 0; column < 8; ++column) {
    if (column != sourceColumn && state.tableau[static_cast<size_t>(column)].empty()) return column;
  }
  return -1;
}

static std::optional<int> dragon_destination(const State& state, int family) {
  if (family_done(state, family)) return std::nullopt;
  int count = 0;
  int matchingCell = -1;
  for (int column = 0; column < 8; ++column) {
    const auto& cards = state.tableau[static_cast<size_t>(column)];
    if (!cards.empty() && family_of(cards.back()) == family) ++count;
  }
  for (int cell = 0; cell < 3; ++cell) {
    const int card = state.freeCells[static_cast<size_t>(cell)];
    if (card >= 0 && family_of(card) == family) {
      ++count;
      if (matchingCell < 0) matchingCell = cell;
    }
  }
  if (count != 4) return std::nullopt;
  if (matchingCell >= 0) return matchingCell;
  const int empty = first_empty_free(state);
  if (empty < 0) return std::nullopt;
  return empty;
}

static void apply_move(State& state, const Action& action) {
  std::vector<int> moving;
  if (action.sourceKind == SourceKind::Tableau) {
    auto& source = state.tableau[static_cast<size_t>(action.sourceIndex)];
    auto it = std::find(source.begin(), source.end(), action.card);
    if (it == source.end()) throw std::runtime_error("solver source card missing");
    moving.assign(it, source.end());
    source.erase(it, source.end());
  } else {
    const int card = state.freeCells[static_cast<size_t>(action.sourceIndex)];
    if (card != action.card) throw std::runtime_error("solver free source mismatch");
    moving.push_back(card);
    state.freeCells[static_cast<size_t>(action.sourceIndex)] = -1;
  }

  if (action.targetKind == TargetKind::Tableau) {
    auto& target = state.tableau[static_cast<size_t>(action.targetIndex)];
    target.insert(target.end(), moving.begin(), moving.end());
  } else if (action.targetKind == TargetKind::FreeCell) {
    if (moving.size() != 1) throw std::runtime_error("solver free target got run");
    state.freeCells[static_cast<size_t>(action.targetIndex)] = moving[0];
  } else {
    if (moving.size() != 1 || !is_number(moving[0])) throw std::runtime_error("solver foundation target got invalid card");
    state.foundations[static_cast<size_t>(action.targetIndex)] += 1;
  }
  normalize(state);
}

static void apply_dragons(State& state, int family, int destination) {
  for (int column = 0; column < 8; ++column) {
    auto& cards = state.tableau[static_cast<size_t>(column)];
    if (!cards.empty() && family_of(cards.back()) == family) cards.pop_back();
  }
  for (int cell = 0; cell < 3; ++cell) {
    const int card = state.freeCells[static_cast<size_t>(cell)];
    if (card >= 0 && family_of(card) == family) state.freeCells[static_cast<size_t>(cell)] = -1;
  }
  state.freeCells[static_cast<size_t>(destination)] = -(family + 2);
  normalize(state);
}

static int state_score(const State& state) {
  int foundations = state.foundations[0] + state.foundations[1] + state.foundations[2];
  int dragons = 0;
  for (int family = 0; family < 3; ++family) if (family_done(state, family)) ++dragons;
  int emptyColumns = 0;
  for (const auto& column : state.tableau) if (column.empty()) ++emptyColumns;
  int emptyFree = 0;
  for (int cell : state.freeCells) if (cell == -1) ++emptyFree;
  return foundations * 10000 + dragons * 50000 + (state.flower ? 5000 : 0) + emptyColumns * 200 + emptyFree * 40;
}

struct Candidate {
  Action action;
  State child;
  int score = 0;
  int order = 0;
};

static void add_candidate(std::vector<Candidate>& out, const State& state, const Action& action, int order) {
  State child = state;
  if (action.kind == ActionKind::CollectDragons) {
    const auto destination = dragon_destination(child, action.family);
    if (!destination) return;
    apply_dragons(child, action.family, *destination);
  } else {
    apply_move(child, action);
  }
  out.push_back(Candidate{action, std::move(child), 0, order});
  out.back().score = state_score(out.back().child);
}

static std::vector<Candidate> generate_candidates(const State& state) {
  std::vector<Candidate> candidates;
  int order = 0;

  // Manual foundations first: these are the only foundation moves not already normalized automatically.
  for (int column = 0; column < 8; ++column) {
    const auto& cards = state.tableau[static_cast<size_t>(column)];
    if (cards.empty()) continue;
    const int card = cards.back();
    if (is_number(card) && rank_of(card) == state.foundations[static_cast<size_t>(suit_of(card))] + 1) {
      add_candidate(candidates, state, Action{ActionKind::Move, SourceKind::Tableau, column, card, TargetKind::Foundation, suit_of(card), -1}, order++);
    }
  }
  for (int cell = 0; cell < 3; ++cell) {
    const int card = state.freeCells[static_cast<size_t>(cell)];
    if (card >= 0 && is_number(card) && rank_of(card) == state.foundations[static_cast<size_t>(suit_of(card))] + 1) {
      add_candidate(candidates, state, Action{ActionKind::Move, SourceKind::FreeCell, cell, card, TargetKind::Foundation, suit_of(card), -1}, order++);
    }
  }

  for (int family = 0; family < 3; ++family) {
    if (dragon_destination(state, family)) {
      Action action; action.kind = ActionKind::CollectDragons; action.family = family;
      add_candidate(candidates, state, action, order++);
    }
  }

  // Move valid tableau suffixes onto non-empty compatible columns.
  for (int sourceColumn = 0; sourceColumn < 8; ++sourceColumn) {
    const auto& source = state.tableau[static_cast<size_t>(sourceColumn)];
    if (source.empty()) continue;
    for (int start = static_cast<int>(source.size()) - 1; start >= 0; --start) {
      if (!valid_run_suffix(source, start)) break;
      const int root = source[static_cast<size_t>(start)];
      if (!is_number(root) && start != static_cast<int>(source.size()) - 1) continue;
      for (int targetColumn = 0; targetColumn < 8; ++targetColumn) {
        if (targetColumn == sourceColumn) continue;
        const auto& target = state.tableau[static_cast<size_t>(targetColumn)];
        if (target.empty() || !can_stack_on(root, target.back())) continue;
        add_candidate(candidates, state, Action{ActionKind::Move, SourceKind::Tableau, sourceColumn, root, TargetKind::Tableau, targetColumn, -1}, order++);
      }
    }
  }

  // Free-cell cards onto non-empty tableau columns.
  for (int cell = 0; cell < 3; ++cell) {
    const int card = state.freeCells[static_cast<size_t>(cell)];
    if (card < 0) continue;
    for (int targetColumn = 0; targetColumn < 8; ++targetColumn) {
      const auto& target = state.tableau[static_cast<size_t>(targetColumn)];
      if (!target.empty() && can_stack_on(card, target.back())) {
        add_candidate(candidates, state, Action{ActionKind::Move, SourceKind::FreeCell, cell, card, TargetKind::Tableau, targetColumn, -1}, order++);
      }
    }
  }

  // Use one representative empty tableau because empty columns are mechanically symmetric.
  for (int sourceColumn = 0; sourceColumn < 8; ++sourceColumn) {
    const auto& source = state.tableau[static_cast<size_t>(sourceColumn)];
    if (source.empty()) continue;
    const int emptyTarget = first_empty_tableau_except(state, sourceColumn);
    if (emptyTarget < 0) break;
    for (int start = static_cast<int>(source.size()) - 1; start >= 0; --start) {
      if (!valid_run_suffix(source, start)) break;
      if (start == 0) continue; // moving a whole column to an empty column is a pure permutation.
      const int root = source[static_cast<size_t>(start)];
      add_candidate(candidates, state, Action{ActionKind::Move, SourceKind::Tableau, sourceColumn, root, TargetKind::Tableau, emptyTarget, -1}, order++);
    }
  }
  const int anyEmptyTableau = first_empty_tableau_except(state, -1);
  if (anyEmptyTableau >= 0) {
    for (int cell = 0; cell < 3; ++cell) {
      const int card = state.freeCells[static_cast<size_t>(cell)];
      if (card >= 0) add_candidate(candidates, state, Action{ActionKind::Move, SourceKind::FreeCell, cell, card, TargetKind::Tableau, anyEmptyTableau, -1}, order++);
    }
  }

  // Exposed tableau single to one representative empty normal free cell.
  const int emptyFree = first_empty_free(state);
  if (emptyFree >= 0) {
    for (int sourceColumn = 0; sourceColumn < 8; ++sourceColumn) {
      const auto& source = state.tableau[static_cast<size_t>(sourceColumn)];
      if (source.empty()) continue;
      const int card = source.back();
      add_candidate(candidates, state, Action{ActionKind::Move, SourceKind::Tableau, sourceColumn, card, TargetKind::FreeCell, emptyFree, -1}, order++);
    }
  }

  std::stable_sort(candidates.begin(), candidates.end(), [](const Candidate& a, const Candidate& b) {
    if (a.score != b.score) return a.score > b.score;
    return a.order < b.order;
  });
  return candidates;
}

static constexpr size_t MAX_DECISION_DEPTH = 2000;

struct SearchContext {
  uint64_t budget = 0;
  uint64_t nodes = 0;
  bool exhausted = false;
  bool depthLimited = false;
  std::unordered_set<std::string> visited;
  std::vector<Action> path;
  std::vector<Action> solution;
};

static bool dfs(const State& state, SearchContext& ctx) {
  if (won(state)) { ctx.solution = ctx.path; return true; }
  if (ctx.path.size() >= MAX_DECISION_DEPTH) { ctx.depthLimited = true; return false; }
  if (ctx.nodes >= ctx.budget) { ctx.exhausted = true; return false; }
  ++ctx.nodes;

  const std::string key = state_key(state);
  if (!ctx.visited.insert(key).second) return false;

  auto candidates = generate_candidates(state);
  for (const Candidate& candidate : candidates) {
    ctx.path.push_back(candidate.action);
    if (dfs(candidate.child, ctx)) return true;
    ctx.path.pop_back();
    if (ctx.exhausted) return false;
  }
  return false;
}

static void print_action_json(const Action& action) {
  if (action.kind == ActionKind::CollectDragons) {
    std::cout << "{\"kind\":\"collect-dragons\",\"family\":\"" << family_name(action.family) << "\"}";
    return;
  }
  std::cout << "{\"kind\":\"move\",\"source\":{";
  if (action.sourceKind == SourceKind::Tableau) {
    std::cout << "\"zone\":\"tableau\",\"column\":" << action.sourceIndex;
  } else {
    std::cout << "\"zone\":\"free-cell\",\"cell\":" << action.sourceIndex;
  }
  std::cout << ",\"cardId\":\"" << card_id(action.card) << "\"},\"target\":{";
  if (action.targetKind == TargetKind::Tableau) {
    std::cout << "\"zone\":\"tableau\",\"column\":" << action.targetIndex;
  } else if (action.targetKind == TargetKind::FreeCell) {
    std::cout << "\"zone\":\"free-cell\",\"cell\":" << action.targetIndex;
  } else {
    std::cout << "\"zone\":\"foundation\",\"suit\":\"" << suit_name(action.targetIndex) << "\"";
  }
  std::cout << "}}";
}

static int solve(uint32_t seed, uint64_t budget) {
  State state = create_deal(seed);
  normalize(state);
  SearchContext ctx;
  ctx.budget = budget;
  ctx.visited.reserve(static_cast<size_t>(std::min<uint64_t>(budget, 2'000'000)));
  const bool solved = dfs(state, ctx);

  if (solved) {
    std::cout << "{\"status\":\"SOLVED\",\"seed\":" << seed << ",\"nodes\":" << ctx.nodes << ",\"proof\":[";
    for (size_t index = 0; index < ctx.solution.size(); ++index) {
      if (index) std::cout << ',';
      print_action_json(ctx.solution[index]);
    }
    std::cout << "]}\n";
    return 0;
  }
  if (ctx.exhausted || ctx.depthLimited) {
    std::cout << "{\"status\":\"UNDETERMINED\",\"seed\":" << seed << ",\"nodes\":" << ctx.nodes << "}\n";
    return 4;
  }
  std::cout << "{\"status\":\"UNSOLVABLE\",\"seed\":" << seed << ",\"nodes\":" << ctx.nodes << "}\n";
  return 3;
}

int main(int argc, char** argv) {
  uint64_t seedValue = 0;
  uint64_t budget = 0;
  bool proofJson = false;
  bool dealJson = false;
  try {
    for (int i = 1; i < argc; ++i) {
      const std::string arg = argv[i];
      if (arg == "--seed" && i + 1 < argc) seedValue = std::stoull(argv[++i]);
      else if (arg == "--budget" && i + 1 < argc) budget = std::stoull(argv[++i]);
      else if (arg == "--proof-json") proofJson = true;
      else if (arg == "--deal-json") dealJson = true;
      else { std::cerr << "Unknown or incomplete argument: " << arg << '\n'; return 2; }
    }
  } catch (const std::exception& error) {
    std::cerr << "Invalid numeric argument: " << error.what() << '\n';
    return 2;
  }
  if (seedValue < 1 || seedValue > 0xffffffffULL) { std::cerr << "seed must be positive uint32\n"; return 2; }
  const auto seed = static_cast<uint32_t>(seedValue);
  if (dealJson) { print_deal_json(seed); return 0; }
  if (!proofJson || budget < 1) { std::cerr << "--budget and --proof-json are required\n"; return 2; }
  try { return solve(seed, budget); }
  catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 2; }
}
