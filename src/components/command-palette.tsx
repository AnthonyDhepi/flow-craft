import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CornerDownLeft, Search } from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  section: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.section} ${command.hint ?? ''}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, filtered.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const command = filtered[active];
      if (command) {
        onClose();
        command.run();
      }
    }
  };

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="command-palette__search">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actions and shapes…"
            aria-label="Command search"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-palette__list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="command-palette__empty">No matching commands</div>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  type="button"
                  className="command-item"
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    onClose();
                    command.run();
                  }}
                >
                  <span className="command-item__icon"><Icon size={16} /></span>
                  <span className="command-item__label">{command.label}</span>
                  <span className="command-item__section">{command.section}</span>
                  {index === active ? <CornerDownLeft className="command-item__enter" size={14} /> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
