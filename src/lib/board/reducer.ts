import type { BoardAction } from "./actions";
import { moveCard, syncDerivedFields } from "./operations";
import type { BoardState } from "./types";

export function boardReducer(board: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "HYDRATE":
    case "RESTORE":
      return action.board;

    case "ADD_CARD": {
      if (board.cards[action.id]) return board;
      const todo = [...board.columns.TODO, action.id];
      return {
        cards: {
          ...board.cards,
          [action.id]: {
            id: action.id,
            title: action.title,
            description: action.description,
            status: "TODO",
            order: todo.length - 1,
            createdAt: action.now,
            updatedAt: action.now,
          },
        },
        columns: { ...board.columns, TODO: todo },
      };
    }

    case "UPDATE_CARD": {
      const card = board.cards[action.id];
      if (!card) return board;
      return {
        ...board,
        cards: {
          ...board.cards,
          [action.id]: {
            ...card,
            title: action.title,
            description: action.description,
            updatedAt: action.now,
          },
        },
      };
    }

    case "DELETE_CARD": {
      const card = board.cards[action.id];
      if (!card) return board;
      const cards = { ...board.cards };
      delete cards[action.id];
      const columns = {
        ...board.columns,
        [card.status]: board.columns[card.status].filter((id) => id !== action.id),
      };
      return syncDerivedFields({ cards, columns });
    }

    case "MOVE_CARD":
      return moveCard(board, action.id, action.toStatus, action.toIndex, action.now);
  }
}
