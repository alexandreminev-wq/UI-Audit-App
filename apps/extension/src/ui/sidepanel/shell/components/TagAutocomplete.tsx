import React, { useState, useEffect, useRef } from 'react';

interface ProjectTagRecord {
  id: string;
  projectId: string;
  tagName: string;
  usageCount: number;
  createdAt: number;
  lastUsedAt: number;
}

interface TagAutocompleteProps {
  projectId: string;
  currentTags: string[];
  onAddTag: (tag: string) => void;
  placeholder?: string;
}

export function TagAutocomplete({
  projectId,
  currentTags,
  onAddTag,
  placeholder = 'Add a tag...',
}: TagAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [allTags, setAllTags] = useState<ProjectTagRecord[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all project tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'TAGS/GET_ALL',
          projectId,
        });

        if (response?.ok && response.tags) {
          setAllTags(response.tags);
        }
      } catch (err) {
        console.error('[TagAutocomplete] Failed to fetch tags:', err);
      }
    };

    fetchTags();
  }, [projectId]);

  // Filter tags based on input and exclude already-added tags
  const filteredTags = allTags.filter(
    (tag) =>
      !currentTags.includes(tag.tagName) &&
      tag.tagName.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Check if input exactly matches an existing tag
  const exactMatch = filteredTags.some(
    (tag) => tag.tagName.toLowerCase() === inputValue.toLowerCase()
  );

  // Show "Create new tag" option if input is not empty and doesn't exactly match
  const showCreateOption = inputValue.trim() !== '' && !exactMatch;

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
    setHighlightedIndex(0);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  // Handle tag selection
  const handleSelectTag = (tagName: string) => {
    onAddTag(tagName);
    setInputValue('');
    setShowDropdown(false);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    const totalOptions = filteredTags.length + (showCreateOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalOptions);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (totalOptions === 0) return;

      if (highlightedIndex < filteredTags.length) {
        // Select existing tag
        handleSelectTag(filteredTags[highlightedIndex].tagName);
      } else if (showCreateOption) {
        // Create new tag
        handleSelectTag(inputValue.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
      setInputValue('');
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'hsl(var(--ring))';
          handleInputFocus();
        }}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 13,
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      {showDropdown && (filteredTags.length > 0 || showCreateOption) && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            background: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
          }}
        >
          {filteredTags.map((tag, index) => (
            <button
              key={tag.id}
              onClick={() => handleSelectTag(tag.tagName)}
              style={{
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                border: 'none',
                background:
                  index === highlightedIndex
                    ? 'hsl(var(--accent))'
                    : 'transparent',
                color:
                  index === highlightedIndex
                    ? 'hsl(var(--accent-foreground))'
                    : 'hsl(var(--foreground))',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span>{tag.tagName}</span>
              <span
                style={{
                  fontSize: 11,
                  color:
                    index === highlightedIndex
                      ? 'hsl(var(--accent-foreground))'
                      : 'hsl(var(--muted-foreground))',
                }}
              >
                {tag.usageCount} {tag.usageCount === 1 ? 'use' : 'uses'}
              </span>
            </button>
          ))}

          {showCreateOption && (
            <button
              onClick={() => handleSelectTag(inputValue.trim())}
              style={{
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                border: 'none',
                borderTop:
                  filteredTags.length > 0
                    ? '1px solid hsl(var(--border))'
                    : 'none',
                background:
                  highlightedIndex === filteredTags.length
                    ? 'hsl(var(--accent))'
                    : 'transparent',
                color:
                  highlightedIndex === filteredTags.length
                    ? 'hsl(var(--accent-foreground))'
                    : 'hsl(var(--foreground))',
                cursor: 'pointer',
                fontSize: 13,
                fontStyle: 'italic',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={() => setHighlightedIndex(filteredTags.length)}
            >
              Create new tag: "{inputValue.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

