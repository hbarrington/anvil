import { describe, test, expect } from 'vitest';
import { parseTable, createDependencyTable, parseMarkdownToForm, convertFormToMarkdown, parseTodosTable, setTodoStatusInMarkdown, upsertTodosInMarkdown, Dependency } from './markdownUtils';

describe('Dependency Parsing Functions', () => {
  describe('parseTable', () => {
    test('should parse valid 2-column Internal Upstream Dependency table', () => {
      const markdown = `# Test Capability

## Dependencies

### Internal Upstream Dependency

| Capability ID | Description |
|---------------|-------------|
| CAP-0087 | Auto-generated reverse dependency |
| CAP-1234 | Another dependency |

### Internal Downstream Impact

| Capability ID | Description |
|---------------|-------------|
| CAP-5887 | Test downstream |
`;

      const result = parseTable(markdown, 'Internal Upstream Dependency');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'CAP-0087',
        description: 'Auto-generated reverse dependency'
      });
      expect(result[1]).toEqual({
        id: 'CAP-1234',
        description: 'Another dependency'
      });
    });

    test('should parse valid 2-column Internal Downstream Impact table', () => {
      const markdown = `# Test Capability

## Dependencies

### Internal Downstream Impact

| Capability ID | Description |
|---------------|-------------|
| CAP-5887 | Test downstream impact |
`;

      const result = parseTable(markdown, 'Internal Downstream Impact');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'CAP-5887',
        description: 'Test downstream impact'
      });
    });

    test('should handle empty table gracefully', () => {
      const markdown = `# Test Capability

## Dependencies

### Internal Upstream Dependency

| Capability ID | Description |
|---------------|-------------|
| | |
`;

      const result = parseTable(markdown, 'Internal Upstream Dependency');

      expect(result).toHaveLength(0);
    });

    test('should handle missing section gracefully', () => {
      const markdown = `# Test Capability

## Other Section

Some content here.
`;

      const result = parseTable(markdown, 'Internal Upstream Dependency');

      expect(result).toHaveLength(0);
    });

    test('should handle malformed table rows', () => {
      const markdown = `# Test Capability

## Dependencies

### Internal Upstream Dependency

| Capability ID | Description |
|---------------|-------------|
| CAP-0087 | Valid dependency |
| Malformed row without separator |
| CAP-1234 | Another valid one |
`;

      const result = parseTable(markdown, 'Internal Upstream Dependency');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'CAP-0087',
        description: 'Valid dependency'
      });
      expect(result[1]).toEqual({
        id: 'CAP-1234',
        description: 'Another valid one'
      });
    });

    test('should handle extra whitespace in cells', () => {
      const markdown = `# Test Capability

## Dependencies

### Internal Upstream Dependency

| Capability ID | Description |
|---------------|-------------|
|  CAP-0087  |  Auto-generated reverse dependency  |
`;

      const result = parseTable(markdown, 'Internal Upstream Dependency');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'CAP-0087',
        description: 'Auto-generated reverse dependency'
      });
    });

    test('should handle partial empty cells', () => {
      const markdown = `# Test Capability

## Dependencies

### Internal Upstream Dependency

| Capability ID | Description |
|---------------|-------------|
| CAP-0087 | |
| | Some description |
`;

      const result = parseTable(markdown, 'Internal Upstream Dependency');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'CAP-0087',
        description: ''
      });
      expect(result[1]).toEqual({
        id: '',
        description: 'Some description'
      });
    });
  });

  describe('createDependencyTable', () => {
    test('should create valid 2-column table from dependency array', () => {
      const dependencies: Dependency[] = [
        { id: 'CAP-0087', description: 'Auto-generated reverse dependency' },
        { id: 'CAP-1234', description: 'Another dependency' }
      ];

      const result = createDependencyTable(dependencies);

      const expectedTable = `| Capability ID | Description |
|---------------|-------------|
| CAP-0087 | Auto-generated reverse dependency |
| CAP-1234 | Another dependency |`;

      expect(result.trim()).toBe(expectedTable);
    });

    test('should create empty table when no dependencies', () => {
      const dependencies: Dependency[] = [];

      const result = createDependencyTable(dependencies);

      const expectedTable = `| Capability ID | Description |
|---------------|-------------|
| | |`;

      expect(result.trim()).toBe(expectedTable);
    });

    test('should handle dependencies with empty fields', () => {
      const dependencies: Dependency[] = [
        { id: 'CAP-0087', description: '' },
        { id: '', description: 'Some description' }
      ];

      const result = createDependencyTable(dependencies);

      const expectedTable = `| Capability ID | Description |
|---------------|-------------|
| CAP-0087 |  |
|  | Some description |`;

      expect(result.trim()).toBe(expectedTable);
    });
  });

  describe('Round-trip dependency processing', () => {
    test('should maintain data integrity through parse → create cycle', () => {
      const originalMarkdown = `# Test Capability

## Dependencies

### Internal Upstream Dependency

| Capability ID | Description |
|---------------|-------------|
| CAP-0087 | Auto-generated reverse dependency |
| CAP-1234 | Another dependency |

### Internal Downstream Impact

| Capability ID | Description |
|---------------|-------------|
| CAP-5887 | Test downstream |
`;

      // Parse dependencies from markdown
      const upstreamDeps = parseTable(originalMarkdown, 'Internal Upstream Dependency');
      const downstreamDeps = parseTable(originalMarkdown, 'Internal Downstream Impact');

      // Recreate tables from parsed data
      const upstreamTable = createDependencyTable(upstreamDeps);
      const downstreamTable = createDependencyTable(downstreamDeps);

      // Verify upstream dependencies
      expect(upstreamDeps).toHaveLength(2);
      expect(upstreamDeps[0]).toEqual({
        id: 'CAP-0087',
        description: 'Auto-generated reverse dependency'
      });

      // Verify downstream dependencies
      expect(downstreamDeps).toHaveLength(1);
      expect(downstreamDeps[0]).toEqual({
        id: 'CAP-5887',
        description: 'Test downstream'
      });

      // Verify table recreation
      expect(upstreamTable).toContain('CAP-0087');
      expect(upstreamTable).toContain('Auto-generated reverse dependency');
      expect(downstreamTable).toContain('CAP-5887');
      expect(downstreamTable).toContain('Test downstream');
    });
  });
});

describe('To Do Tracking', () => {
  const capabilityWithTodos = `# Test Cap

## Metadata
- **Name**: Test Cap
- **Type**: Capability
- **ID**: CAP-1000
- **Status**: In Draft
- **Approval**: Not Approved
- **Priority**: High

## Technical Overview
### Purpose
Do things

## Enablers
| Enabler ID |
|------------|
| ENB-1000 |

## Dependencies

### Internal Upstream Dependency

| Capability ID | Description |
|---------------|-------------|
| | |

## Technical Specifications

### Diagram
some spec content

## To Do

| Order | Name | Description | Status |
|-------|------|-------------|--------|
| 2 | Write docs | Document the flow | To Do |
| 1 | Wire the API | Hook up the endpoint | In Progress |

# Development Plan
plan content here
`;

  test('parses the To Do table without swallowing neighbouring sections', () => {
    const parsed: any = parseMarkdownToForm(capabilityWithTodos, 'capability');

    expect(parsed.todos).toHaveLength(2);
    // Sorted by Order, so the item with order 1 comes first
    expect(parsed.todos[0]).toEqual({
      order: 1,
      name: 'Wire the API',
      description: 'Hook up the endpoint',
      status: 'In Progress'
    });
    expect(parsed.todos[1].order).toBe(2);
    expect(parsed.technicalSpecifications).not.toContain('To Do');
    expect(parsed.implementationPlan).toContain('plan content here');
  });

  test('round trips without duplicating the To Do section', () => {
    const parsed: any = parseMarkdownToForm(capabilityWithTodos, 'capability');
    const markdown = convertFormToMarkdown(parsed, 'capability');

    expect((markdown.match(/^## To Do$/gm) || []).length).toBe(1);
    expect(markdown).toContain('| 1 | Wire the API | Hook up the endpoint | In Progress |');

    // The written table is ordered, so the viewer renders it 1 first
    const rows = markdown.split(/\r?\n/).filter(line => line.startsWith('| 1 |') || line.startsWith('| 2 |'));
    expect(rows[0]).toContain('Wire the API');
    expect(rows[1]).toContain('Write docs');

    const reparsed: any = parseMarkdownToForm(markdown, 'capability');
    expect(reparsed.todos).toEqual(parsed.todos);
    expect((convertFormToMarkdown(reparsed, 'capability').match(/^## To Do$/gm) || []).length).toBe(1);
  });

  test('falls back to row position for tables written without an Order column', () => {
    const legacy = `# Legacy

## To Do

| Name | Description | Status |
|------|-------------|--------|
| First thing | Do this first | To Do |
| Second thing | Then this | Done |
`;

    const todos = parseTodosTable(legacy);
    expect(todos.map(todo => todo.order)).toEqual([1, 2]);
    expect(todos[0].name).toBe('First thing');
  });

  test('toggles a single to do status without touching the rest of the document', () => {
    const updated = setTodoStatusInMarkdown(
      capabilityWithTodos,
      { order: 1, name: 'Wire the API', description: 'Hook up the endpoint', status: 'In Progress' },
      'Done'
    );

    expect(updated).toContain('| 1 | Wire the API | Hook up the endpoint | Done |');
    expect(updated).toContain('| 2 | Write docs | Document the flow | To Do |');

    // Everything outside the toggled row is byte-identical
    const before = capabilityWithTodos.split(/\r?\n/);
    const after = updated.split(/\r?\n/);
    expect(after.length).toBe(before.length);
    const changed = after.filter((line, index) => line !== before[index]);
    expect(changed).toHaveLength(1);
  });

  test('returns the document unchanged when the to do is not found', () => {
    const updated = setTodoStatusInMarkdown(
      capabilityWithTodos,
      { order: 9, name: 'Missing', description: '', status: 'To Do' },
      'Done'
    );

    expect(updated).toBe(capabilityWithTodos);
  });

  test('adds a to do in place, leaving other sections alone', () => {
    const existing = parseTodosTable(capabilityWithTodos);
    const updated = upsertTodosInMarkdown(capabilityWithTodos, [
      ...existing,
      { order: 3, name: 'Ship it', description: '', status: 'To Do' }
    ]);

    const todos = parseTodosTable(updated);
    expect(todos).toHaveLength(3);
    expect(todos[2].name).toBe('Ship it');
    expect(updated).toContain('# Development Plan');
    expect(updated).toContain('some spec content');
    expect((updated.match(/^## To Do$/gm) || []).length).toBe(1);
  });

  test('appends a To Do section to a document that has none', () => {
    const plain = `# Plain

## Technical Overview
### Purpose
Nothing here yet
`;

    const updated = upsertTodosInMarkdown(plain, [
      { order: 1, name: 'First', description: 'Do it', status: 'To Do' }
    ]);

    expect(updated).toContain('## To Do');
    expect(parseTodosTable(updated)).toEqual([
      { order: 1, name: 'First', description: 'Do it', status: 'To Do' }
    ]);
  });

  test('writes an empty To Do table when a document has none', () => {
    const markdown = convertFormToMarkdown({
      name: 'Test Enabler',
      owner: 'Product Team',
      status: 'In Draft',
      approval: 'Not Approved',
      priority: 'High',
      analysisReview: 'Required',
      designReview: 'Required',
      codeReview: 'Not Required'
    } as any, 'enabler');

    expect(markdown).toContain('## To Do');
    expect(parseTodosTable(markdown)).toEqual([]);
  });
});
