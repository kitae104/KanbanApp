import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { SyntheticEvent } from "react";
import { isStatus } from "@/lib/board/types";

type Activator = { eventName: string; handler: (...args: never[]) => boolean | undefined };

function guard<T extends Activator>(activators: T[], allow: (event: SyntheticEvent) => boolean): T[] {
  return activators.map((activator) => ({
    ...activator,
    handler: ((event: SyntheticEvent, ...rest: unknown[]) =>
      allow(event) &&
      (activator.handler as (...args: unknown[]) => boolean | undefined)(event, ...rest)) as T["handler"],
  }));
}

const CONTROLS = "button, a, input, textarea, select";

/** 카드 안의 수정·삭제 버튼을 누를 때는 드래그를 시작하지 않는다. */
const notOnControl = (event: SyntheticEvent) =>
  !(event.target instanceof Element && event.target.closest(CONTROLS));

/** 키보드 드래그는 카드 자체에 포커스가 있을 때만 시작한다(버튼의 Space/Enter와 구분). */
const onCardItself = (event: SyntheticEvent) => event.target === event.currentTarget;

// PointerSensor는 터치에도 반응해 TouchSensor의 지연(스크롤 구분)을 무력화하므로 Mouse/Touch를 나눠 쓴다.
export class CardMouseSensor extends MouseSensor {
  static activators = guard(MouseSensor.activators, notOnControl);
}

export class CardTouchSensor extends TouchSensor {
  static activators = guard(TouchSensor.activators, notOnControl);
}

export class CardKeyboardSensor extends KeyboardSensor {
  static activators = guard(KeyboardSensor.activators, onCardItself);
}

/**
 * 포인터가 어느 컬럼 위에도 없으면 놓을 곳이 없다고 본다(FR-14: 컬럼 밖 드롭은 취소).
 * 컬럼 위라면 그 컬럼과 그 안의 카드 중에서 closestCorners로 고른다.
 * 키보드 드래그처럼 포인터 좌표가 없으면 closestCorners를 그대로 쓴다.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCorners(args);

  const column = pointerWithin(args).find((collision) => isStatus(collision.id));
  if (!column) return [];

  const droppableContainers = args.droppableContainers.filter(
    (container) =>
      container.id === column.id || container.data.current?.sortable?.containerId === column.id,
  );
  return closestCorners({ ...args, droppableContainers });
};
