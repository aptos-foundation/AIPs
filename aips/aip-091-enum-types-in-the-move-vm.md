---
aip: 91
title: Enum Types in the Move VM
author: Wolfgang Grieskamp (wg@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Accepted
last-call-end-date (*optional): 8/5/2024
type: Standard Language
created: 7/21/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-91 - Enum Types in the Move VM

## Summary

Move-2 adds a collection of new features to the Move language as it is used on Aptos. Enum types (often also referred to as *algebraic data types*, ADT) is one of those features. Move enum types allow to specify a set of _variants_ of the structure of a value. Code can be written which inspects values at runtime, matching over the possible variants. In this AIP the extensions to the Move VM enabling enum types are described.

### Motivation

It is well known that ADTs have many advantages in software design. Most modern languages support ADTs -- for example, Rust, Haskell, Scala, Swift, and Kotlin. One particular use case in the Move world is *versioning* of data. Consider the following definition:

```move
enum VersionedData has key {
    V1{name: String}           // This is how we started
    V2{name: String, age: u64} // Later we added this variant with a new field
}
```

It is possible to add new variants -- here `V2` -- to existing enum types without violating upgrade compatibility. This allows to change the data layout 'in place', reusing the same storage slot, as shown in this example:

```move
fun upgrade_if_needed(addr: address) acquires VersionedData {
    let r = borrow_global_mut<VersionedData>(addr);
    match (r) {
        V1{name} => {
            *r = VersionedData::V2{name, age: 0}
        }
        _ => {
            // Already V2, nothing to do
        }
    }
}
```

It is also possible -- in difference to ADT implementations in other languages -- to perform field selection on shared fields, as in

```move
fun get_name(data: &VersionedData): &String {
    data.name
}
```

This allows old code to continue to work without changes on features shared between enum variants.

This AIP focuses on the extensions to the Move VM needed to implement enum types. The extensions are discussed in terms of the [Move Binary Format](https://github.com/aptos-labs/aptos-core/blob/main/third_party/move/move-binary-format/src/file_format.rs), including the new opcodes and their semantics.

### Out of Scope

- The actual source language representation of enum types. The description is found in the Move Book. TODO: link
- Possible future extensions, specifically for optimization purposes. For example, currently variant matching must be compiled to predicates, but a 'switch' instruction with a jump table is more efficient for large match expressions. This instruction may be added later.
- Dealing with public enum types (or more general, struct types). Extensions to the binary format for this purpose are out of scope for this AIP, however, taken in consideration. 

## High-level Overview

Enum types are interpreted as a special form of struct types. Instead of just fields, the struct layout can be either `Singleton` for a traditional struct or `Variants` for a list of variants. For this reason, the technical name for enum types in the VM is *variant struct*.

There are many advantages of folding enums into the existing struct representation. Specifically since backends consume serialized representations of structs, and don’t care whether a blob is an enum or not, the enum extension does not cascade into those components. Also, for RAM representation of enums this viewpoint is suitable. Like in a C union, the variant tag determines the interpretation of the memory blob, but otherwise it behaves like a struct.

A number of new instructions need to be introduced to deal with enums, notably a new form of borrow operation on fields of variants that aborts for unexpected variants. The later one is needed for allowing frontends to generate matching code via references to the data.

## Impact

This is a significant extension to the Move VM which will highly improve the quality of the code which can be written in Move. This first version contains the minimal necessary set of new features, more are needed in the future for improving performance.

## Alternative solutions

There are no viable alternatives known. The closest would be to represent a variant type as a struct with optional fields, but this is inefficient and would not give upgradability. 

If we think about upgradeability problem itself, the serialization protocol could be changed/extended, to support upgradable structs. But that is a significant change to the serialization protocol, and enum types solve variety of other needs as well.

## Specification and Implementation Details

### Representation of Enum Types

To represent enum types (aka 'variant structs') the existing `StructDefinition` type is extended as follows:

```rust
pub struct StructDefinition {
    ...
    pub field_information: StructFieldInformation,
}
pub enum StructFieldInformation {
    Native,
    Declared(Vec<FieldDefinition>),
    // New variant
    DeclaredVariants(Vec<VariantDefinition>),
}
pub struct FieldDefinition {
    pub name: IdentifierIndex,
    pub signature: TypeSignature,
}
// New struct
pub struct VariantDefinition {
    pub name: IdentifierIndex,
    pub fields: Vec<FieldDefinition>,
}
```

The extension is neutral in serialization size.


### Representation as VM 1.0 Value Types

In the current Move VM value system, an enum is represented as a container of values (similar to structs and vectors). The first element in this container is a `u16` with the variant tag, the remaining values are interpreted depending on the variant.

### Serialization

#### BCS

Serialization via BCS must be compact and efficient. Another requirement is that there is a direct marshalling between Move and Rust enum types, as it is possible today with regular struct types. This is to support the Move framework and native functions accessing enum resources.

The chosen serialization format is derived from the one Rust uses via serde. The ['externally tagged'](https://serde.rs/enum-representations.html#externally-tagged) representation for enums is used, which also Rust uses by default. For a given variant, the byte blob generated by BCS for a variant starts with a binary tag, followed by a tuple of the bytes of the fields.

#### JSON

In contrast to BCS, for the JSON representation of variants, the ['internally tagged'](https://serde.rs/enum-representations.html#externally-tagged) representation is better suited. The field name `__variant__` is used in this format to represent the given variant via it's string representation.

### Upgrade Compatibility

Variant structs can be upgraded by adding new variants. The new variants must be added, in sequence, after the existing ones which must be a prefix of the variants of the new variant struct.

### Handles

A number of new handle types are needed to access variant structs from instructions. The general principle of Move bytecode is that arguments to an instruction are represented as indices in tables of such handles.

First, a given variant of a struct needs a denotation for operations like pack, unpack, and variant testing:

```rust
type VariantIndex = u16;
pub struct StructVariantHandle {
    pub struct_index: StructDefinitionIndex,
    pub variant: VariantIndex,
}

```

Second, since field borrowing for variant structs is supported, a way to denote a field in a variant is required:

```rust
pub struct VariantFieldHandle {
    pub owner: StructDefinitionIndex,
    pub variants: Vec<VariantIndex>,
    pub field: MemberCount,
}
```

Notice that the variant field handle is defined for the specified set of `variants`: the selected field at the given offset has to be in each of those variants of the same type, as verified by the bytecode verifier. A given variant value which is not among the specified variants will lead to a runtime abort if attempted to select from via this handle. 

The introduction of these new handles (and their associated handle instantiation types for generics) requires 4 additional tables in the binary format. This creates a significant new boilerplate.

> Design Choice: The alternative design would have folded the variant information into the existing FieldHandle and other types (as a field with an optional value). However, this design would lead to increase in binary format size for existing code which, without any change in the source, is compiled to the new binary format. For every field handle in the original, an additional option value needs to be serialized to represent the absence of any variants. This appeared to be suboptimal. With the current design, existing code should be identical if compiled for the new format.

### Instructions

#### Pack/Unpack/Test

For packing and unpacking variants, the following new instructions are introduced (each instruction also has a ‘Generic’ version, which is omitted here):

```rust
pub enum Bytecode {
    ...
    PackVariant(StructVariantHandleIndex),
    UnpackVariant(StructVariantHandleIndex),
    TestVariant(StructVariantHandleIndex),
}
```

The pack instructions pops the number of arguments expected for the specified variant and creates a value of the variant. The unpack instruction checks whether the value on the stack is of the given variant, and pushes the values of its fields if so, otherwise it aborts. The test instruction pushes a boolean indicating whether the value is of the given variant.

#### Field Borrow

For borrowing of fields, the following new instructions (and there implicit generic versions) are introduced:

```rust
pub enum Bytecode {
    ...
    ImmBorrowVariantField(VariantFieldHandleIndex),
    MutBorrowVariantField(VariantFieldHandleIndex),    
}
```

Recall that variant field handles carry a set of variants for which the field selection is valid. The ‘borrow’ instructions abort if the value on the stack is not any of those specified variants. Notice that for those specified variants, the bytecode verifier ensures that in each variant the field at a given offset has the same type, which is essential for type safety.

> Design Choice: Why carry the set of variants in the handles, as this information is known at compile time and could be derived from the `StructDefinition`? This makes this instruction transparently (and fast) verifiable: one just iterates of the variants and checks whether they satisfy all desired properties (e.g. have the same type).
 
### Bytecode Verifier/Paranoid Mode

The bytecode verifier and paranoid mode performing similar safety checks, so they are discussed here together.

Most verification checks are inherited from those for structs (e.g. ability checks). Differences are in the below areas.

#### Bounds Checks

Besides existing types of indices used in the new handle types, the bounds checker needs to verify that wherever a variant index is used, it refers to an existing variant in the associated `StructDefinition`.

#### Type Safety

- For a variant field handle, for each variant in the specified set, the field at the given offset must exist and have the same type
- For pack and unpack of variants, the values on the stack before and after must have expected types, as determined by the variant

### Compilation Example

For reference, here is an example from [Move 2 source](https://github.com/aptos-labs/aptos-core/blob/main/third_party/move/move-compiler-v2/tests/file-format-generator/struct_variants.move) to [generated binary data](https://github.com/aptos-labs/aptos-core/blob/main/third_party/move/move-compiler-v2/tests/file-format-generator/struct_variants.opt.exp).

## Testing 

The proptest definitions have been extended for the new extensions to the binary format, meaning that some additional fuzzing based verification happens (e.g. `deserialize(serialize(m)) = m` type of tests). 

A number of [transactional tests](third_party/move/move-compiler-v2/transactional-tests/tests/no-v1-comparison/enum) verify the semantic behavior. 

The enum upgrade logic is tested with [this e2e test](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/e2e-move-tests/src/tests/enum_upgrade.rs).

There are more tests needed, specifically for the bytecode verifier. These are expected before the feature is available in `mainnet` ([#14074](https://github.com/aptos-labs/aptos-core/issues/14074)).

## Reference Implementation

- The core implementation is in [PR #13812](https://github.com/aptos-labs/aptos-core/pull/13812).
- [PR #14124](https://github.com/aptos-labs/aptos-core/pull/14124) implements feature gating and adds other touches.
- [PR #14144](https://github.com/aptos-labs/aptos-core/pull/14144) implements decorated enum values and resource viewer as well as API JSON representation.
- [PR #14174](https://github.com/aptos-labs/aptos-core/pull/14174) refines serialization to use Serde's existing enum support, ensuring marshalling compatibility with Rust.


## Risks and Drawbacks

Even though with new tests in place, as well as all the existing tests in the pipeline passing, there is some risk associated with this feature. The risk is minimized by that this is a pure extension (no existing bytecodes have been changed). However, significant refactoring of details in existing code had to happen as part of this work in order to avoid further spreading of code duplication and boilerplate. (10 new instructions and 4 new handle tables had to be added). Those changes happened in the serializers as well as in components of the bytecode verifier, and require careful auditing.

The actual new parts of this feature, enum types, are under gating and will be hardened in testnet first. Enabling them will require a feature flag push.


## Security Considerations

The main impact on existing functionality is via DoS by crash of the refactored code in serializer, deserializer, bytecode verifier, and interpreter. 

The main impact on new functionality of enum types is type confusion, e.g. unpacking the wrong variants, or borrowing the wrong fields.


## Future Potential

Next steps related to this AIP are likely:

- extension of structs (and variant structs aka enums) to be public
- introduction of 'switch' instruction

## Timeline

Before September '24

### Suggested implementation timeline

Before August '24

### Suggested developer platform support timeline

Before September '24

### Suggested deployment timeline

Release with v1.18
