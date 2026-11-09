import * as Haptics from 'expo-haptics';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  PanGesture,
  usePanGesture,
} from 'react-native-gesture-handler';

import { Todo } from './types';

const ROW_HEIGHT = 40;

type DragState = {
  fromIndex: number;
  id: string;
  targetIndex: number;
};

export type TaskReorderControls = {
  onMoveDown?: () => void;
  onMoveUp?: () => void;
  reorderGesture: PanGesture;
  suppressPress: boolean;
};

type ReorderableTaskListProps = {
  onDragStateChange?: (dragging: boolean) => void;
  onReorder: (id: string, toIndex: number) => void;
  renderItem: (todo: Todo, controls: TaskReorderControls) => ReactNode;
  todos: Todo[];
};

type ReorderableTaskItemProps = {
  children: (controls: TaskReorderControls) => ReactNode;
  count: number;
  dragState: DragState | null;
  index: number;
  onAccessibleMove: (id: string, toIndex: number) => void;
  onDragCancel: (id: string) => void;
  onDragEnd: (id: string) => void;
  onDragMove: (id: string, fromIndex: number, distance: number) => void;
  onDragStart: (id: string, fromIndex: number) => void;
  todo: Todo;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function ReorderableTaskList({
  onDragStateChange,
  onReorder,
  renderItem,
  todos,
}: ReorderableTaskListProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const isDragging = Boolean(dragState);

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      !isDragging ||
      typeof document === 'undefined'
    ) {
      return;
    }

    const preventScroll = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };

    document.addEventListener('touchmove', preventScroll, { passive: false });
    return () => document.removeEventListener('touchmove', preventScroll);
  }, [isDragging]);

  const updateDragState = useCallback((nextState: DragState | null) => {
    dragStateRef.current = nextState;
    setDragState(nextState);
  }, []);

  const startDrag = useCallback(
    (id: string, fromIndex: number) => {
      updateDragState({ id, fromIndex, targetIndex: fromIndex });
      onDragStateChange?.(true);
    },
    [onDragStateChange, updateDragState],
  );

  const moveDrag = useCallback(
    (id: string, fromIndex: number, distance: number) => {
      const current = dragStateRef.current;
      if (!current || current.id !== id) return;

      const targetIndex = clamp(
        Math.round(fromIndex + distance / ROW_HEIGHT),
        0,
        todos.length - 1,
      );
      if (targetIndex === current.targetIndex) return;

      updateDragState({ ...current, targetIndex });
    },
    [todos.length, updateDragState],
  );

  const finishDrag = useCallback(
    (id: string, commit: boolean) => {
      const current = dragStateRef.current;
      updateDragState(null);
      onDragStateChange?.(false);

      if (
        commit &&
        current?.id === id &&
        current.targetIndex !== current.fromIndex
      ) {
        onReorder(id, current.targetIndex);
        void Haptics.selectionAsync().catch(() => undefined);
      }
    },
    [onDragStateChange, onReorder, updateDragState],
  );

  const accessibleMove = useCallback(
    (id: string, toIndex: number) => {
      onReorder(id, toIndex);
      void Haptics.selectionAsync().catch(() => undefined);
    },
    [onReorder],
  );

  return (
    <View>
      {todos.map((todo, index) => (
        <ReorderableTaskItem
          count={todos.length}
          dragState={dragState}
          index={index}
          key={todo.id}
          onAccessibleMove={accessibleMove}
          onDragCancel={(id) => finishDrag(id, false)}
          onDragEnd={(id) => finishDrag(id, true)}
          onDragMove={moveDrag}
          onDragStart={startDrag}
          todo={todo}
        >
          {(controls) => renderItem(todo, controls)}
        </ReorderableTaskItem>
      ))}
    </View>
  );
}

function ReorderableTaskItem({
  children,
  count,
  dragState,
  index,
  onAccessibleMove,
  onDragCancel,
  onDragEnd,
  onDragMove,
  onDragStart,
  todo,
}: ReorderableTaskItemProps) {
  const [translateY] = useState(() => new Animated.Value(0));
  const [suppressPress, setSuppressPress] = useState(false);
  const isDragging = dragState?.id === todo.id;

  const reorderGesture = usePanGesture({
    activateAfterLongPress: 320,
    activeCursor: 'grabbing',
    enabled: count > 1,
    runOnJS: true,
    shouldCancelWhenOutside: false,
    onActivate: () => {
      setSuppressPress(true);
      translateY.stopAnimation();
      translateY.setValue(0);
      onDragStart(todo.id, index);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
    },
    onUpdate: (event) => {
      const distance = clamp(
        event.translationY,
        -index * ROW_HEIGHT,
        (count - index - 1) * ROW_HEIGHT,
      );
      translateY.setValue(distance);
      onDragMove(todo.id, index, distance);
    },
    onDeactivate: (event) => {
      translateY.setValue(0);
      setTimeout(() => setSuppressPress(false), 150);
      if (event.canceled) {
        onDragCancel(todo.id);
      } else {
        onDragEnd(todo.id);
      }
    },
  });

  const controls: TaskReorderControls = {
    reorderGesture,
    suppressPress,
    onMoveUp:
      index > 0
        ? () => onAccessibleMove(todo.id, index - 1)
        : undefined,
    onMoveDown:
      index < count - 1
        ? () => onAccessibleMove(todo.id, index + 1)
        : undefined,
  };

  return (
    <View style={[styles.itemShell, isDragging && styles.draggingShell]}>
      <Animated.View
        style={[
          styles.item,
          isDragging && styles.dragging,
          { transform: [{ translateY }] },
        ]}
      >
        {children(controls)}
      </Animated.View>
    </View>
  );
}

export function ReorderGestureDetector({
  children,
  gesture,
}: {
  children: ReactNode;
  gesture: PanGesture;
}) {
  return (
    <GestureDetector
      enableContextMenu={false}
      gesture={gesture}
      touchAction="none"
      userSelect="none"
    >
      {children}
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  itemShell: {
    position: 'relative',
  },
  draggingShell: {
    zIndex: 20,
    elevation: 3,
  },
  item: {
    zIndex: 1,
    backgroundColor: '#fbfbf9',
  },
  dragging: {
    zIndex: 20,
    elevation: 3,
    backgroundColor: '#f1f1ee',
    opacity: 0.96,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
  },
});
