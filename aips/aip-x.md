---
aip: X
title: Move aborts with message
author: Calin Tataru (calin.tataru@aptoslabs.com)
discussions-to: https://github.com/aptos-foundation/AIPs/issues/???
Status: Draft
last-call-end-date: N/A
type: Standard (Core)
created: 22/01/2026
updated: 22/01/2026
requires: N/A
---

# AIP-X: Move abort with message

## Summary

This AIP extends the Move abort mechanism to support **optional, user-facing abort messages.**
These messages are persisted as part of the transaction execution and surfaced through APIs and developer tooling.

The proposal introduces:

1. A new bytecode instruction `AbortMsg` that aborts with:
   - an error code (`u64`), and
   - an error message (`vector<u8>`) interpreted as an UTF-8 string,

   taken from the operand stack.

2. An extension to the Move language `abort` **syntax** to accept an error message instead of an error code.

3. An extension to the `assert!` **macro** to accept formatted messages.

4. New `assert_eq!` and `assert_ne!` **macros** with Rust-like semantics, i.e., evaluate each argument exactly once and, on failure, abort with a descriptive message that identifies the values involved.

All changes are backward compatible.
Abort messages are optional and do not replace abort codes.

## Motivation

Today, Move aborts surface only numeric error codes.
While this enforces a clear and compact on-chain representation, it has significant drawbacks in practice.
In particular:

- Abort failures cannot include **custom, human-readable messages**.
- It is not possible to include **runtime values** (e.g., the value that violated an invariant).
- Developers must maintain **off-chain documentation** mapping error codes to meanings.

As a result, even simple invariant violations can be difficult to diagnose, and user-facing tooling such as wallets and explorers cannot provide meaningful explanations for failed transactions.

This AIP addresses these issues by allowing aborts to carry an optional error message that is persisted on-chain and surfaced through APIs and tooling.
This enables developers to:

- provide clear, contextual explanations for failures,
- include relevant runtime information when appropriate, and
- significantly improve the debugging and user experience across the ecosystem.

For example, the following invariant:

```move
if (value > limit) {
    abort E_LIMIT_EXCEEDED;
}
```
can now be expressed using an abort message that includes the reason the invariant was invalidated (i.e., the values of `value` and `limit`):

```move
if (value > limit) {
    abort string::into_bytes(string_utils::format2(
        &b"Limit exceeded: value={}, limit={}",
        value, limit,
    ));
}
```

## Goals

- Allow Move programs to abort with a custom message.
- Surface abort messages through VM status.
- Keep the syntax ergonomic for both string constants and formatted messages.
- Preserve backward compatibility for existing bytecode.

## Specification

### 1. Bytecode extension: `AbortMsg`

We introduce a new bytecode instruction `AbortMsg` with the following semantics:

- Pops two values from the operand stack in the following order:
    1. `message: vector<u8>` (top of stack)
    2. `code: u64`
- Checks that the length of `message` does not exceed a predefined maximum (currently 1024 bytes). If the limit is exceeded, execution terminates with a VM error with status code `ABORT_MESSAGE_LIMIT_EXCEEDED`.
- Attempts to interpret `message` as a UTF-8 encoded string. If it is not valid UTF-8, execution terminates with a VM error with status code `INVALID_ABORT_MESSAGE`.
- Otherwise, execution terminates with a VM error with status code `ABORTED`, which is the same as the existing `Abort` instruction, carrying the user-provided code and message.

The resulting abort status includes both the error code and error message (which is new). The Move VM has been extended to propagate the message to the `AbortInfo` field of the `ExecutionStatus`, making it available as part of the transaction execution status.

Note that the `AbortMsg` instruction is feature-gated by the `VM_BINARY_FORMAT_V10` flag.

**Gas semantics**

We charge a base fee (twice the cost of a regular abort), plus a per-byte fee for UTF-8 validation, since validation requires scanning the entire message.

**Message precedence**

Validation errors take precedence over the user-provided error code and message.
Specifically, if the abort message exceeds the maximum allowed length, execution terminates with status code `ABORT_MESSAGE_LIMIT_EXCEEDED`.
Otherwise, if the message is not valid UTF-8, execution terminates with status code `INVALID_ABORT_MESSAGE`.
Note that messages originating from `String` values are guaranteed to be valid UTF-8 and therefore cannot trigger `INVALID_ABORT_MESSAGE`.

The provided error message takes precedence over any description present on the error code in the module definition (i.e. using a `///` comment).

**Owned message design**

The abort message is represented as an **owned** `vector<u8>`, rather than a reference, because the most common patterns—string constants and formatted strings-already produce owned values and therefore map efficiently to this instruction.

**Bytecode verification**

The bytecode verifier must ensure the stack types for `AbortMsg` are exactly:

```
..., u64, vector<u8> → ⊥
```

### 2. Language syntax: overloaded `abort`

Extend Move syntax to allow the `abort` statement to be **overloaded**:

```
abort <code>;
abort <message>;
```

Where:

- `<code>` is an expression of type `u64`,
- `<message>` is an expression of type `vector<u8>`.

The compiler distinguishes the two forms based on the inferred type of the operand.
To preserve backwards compatibility, if the operand type cannot be inferred, the compiler must treat it as `u64`.

**Compilation rules**

The new `abort <message>` syntax is lowered by the compiler as follows:
- emit an `LdU64` instruction to push a compiler-defined abort code reserved for unspecified errors onto the operand stack,
- compile the `<message>` expression, and
- emit an `AbortMsg` instruction.

For example:

```
abort b"Hello, world!"
```

compiles to:

```
LdU64 <unspecified_abort_code>
LdConst<vector<u8>> [72, 101, 108, 108, 111, 44, 32, 119, 111, 114, 108, 100, 33]
AbortMsg
```

### 3. Framework support: `String::into_bytes`

To support ergonomic message construction, extend `std::string::String` with:

```
public fun into_bytes(self: String): vector<u8> {
    let String { bytes } = self;
    bytes
}
```

This method:

- consumes the `String`,
- returns its underlying byte representation, and
- enables zero-extra-instruction conversion in common cases.

This is required because:

- `AbortMsg` consumes a `vector<u8>`, and
- `string_utils` formatting functions return a `String`.

### 4. Extended `assert!` macro

The existing forms are unchanged:

```move
assert!(cond);
assert!(cond, code);
```

The extended `assert!` macro allows assertions to abort with descriptive messages while preserving existing behavior.

**Message assertion:**

```move
assert!(cond, message)
```

Where `message: vector<u8>`.

Expands to:

```move
if (cond) {
    ()
} else {
    abort message
}
```

**Formatted message assertion:**

```move
assert!(cond, fmt, arg1, ..., argN) // 1 ≤ N ≤ 4
```

Where `fmt: vector<u8>`.

Expands to:

```move
if (cond) {
    ()
} else {
    abort string::into_bytes(string_utils::format<N>(&fmt, arg1, ..., argN))
}
```

### 5. New macros `assert_eq!` and `assert_ne!`

We introduce new built-in macros `assert_eq!` and `assert_ne!`, which are modeled after Rust's `assert_eq!` and `assert_ne!` macros. 

The `assert_eq!` macro asserts **equality** between two expressions and aborts with a descriptive error message if the assertion fails.
The `assert_ne!` macro works in a similar way, but it asserts **inequality** instead.

Note that these are purely syntactic sugar, and users will incur gas costs when using them.
The more arguments that are formatted, the higher the gas cost.

There are three forms depending on the number of arguments.

**Two arguments:**

```move
assert_eq!(left, right);
```

expands to:

```move
match ((left, right)) {
    (_left, _right) => {
        if (_left == _right) {
            ()
        } else {
            abort string::into_bytes(string_utils::format2(<assertion_failed_message>, _left, _right))
        }
    }
}
```

**Three arguments (custom message):**

```move
assert_eq!(left, right, message)
```

Where `message: vector<u8>`.

Expands to:

```move
match ((left, right)) {
    (_left, _right) => {
        if (_left == _right) {
            ()
        } else {
            abort string::into_bytes(string_utils::format3(<assertion_failed_message>, string::utf8(message), _left, _right))
        }
    }
}
```

**More than three arguments (formatted message):**

```move
assert_eq!(left, right, fmt, arg1, ..., argN) // 1 ≤ N ≤ 4
```

Where `fmt: vector<u8>`.

Expands to:

```move
match ((left, right)) {
    (_left, _right) => {
        if (_left == _right) {
            ()
        } else {
            abort string::into_bytes(string_utils::format3(<assertion_failed_message>, string_utils::format<N>(&fmt, arg1, ..., argN), _left, _right))
        }
    }
}
```

**Assertion failed message format**

The assertion failure message format is inspired by Rust and shows both evaluated values:

```
assertion failed `left == right`
  left: <left>
 right: <right>
```

It can also include a custom message:
```
assertion failed `left == right`: <message>
  left: <left>
 right: <right>
```

## Backward Compatibility

- Existing bytecode remains valid.
- Existing `abort` and `assert!` behavior is preserved.

## Implementation

The following pull requests implement this proposal.

### Move/Aptos VM

- [aptos-core#18316](https://github.com/aptos-labs/aptos-core/pull/18316): New VM instruction for aborting with message
- [aptos-core#18347](https://github.com/aptos-labs/aptos-core/pull/18347): New bytecode for aborting with message

### Move compiler

- [aptos-core#18403](https://github.com/aptos-labs/aptos-core/pull/18403): Overload Move abort to support messages
- [aptos-core#18412](https://github.com/aptos-labs/aptos-core/pull/18412): New macros using abort with message

### Framework

- [aptos-core#18395](https://github.com/aptos-labs/aptos-core/pull/18395): Add `String::into_bytes` function

## Conclusion

This AIP introduces first-class, on-chain abort messages to Move with minimal disruption, strong backward compatibility, and significantly improved developer and user experience.