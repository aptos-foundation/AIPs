---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Move Specification Testing
author: Eiger Team <hello@eiger.co>
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard
created: <12/04/2023>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Move Specification Testing Tools

## Summary

The Move Specification Testing project aims to check whether the Move formal specifications are complete. As there is no standard solution for testing Move specifications, we propose to create a set of tools that will be able to test Move specifications.

The Move Specification Verification tool (`spec-verify`) will be responsible for running The Move Mutator tool, which will be able to generate Move programs (mutants) by introducing small changes in the code. Then, they will be passed to the Move Prover and checked if they are valid according to the Move specifications. The number of mutants killed will measure how good the specification is. The tool will also generate appropriate reports.

### Goals

This AIP intends to achieve the following:
- Create a tool (`mutate`) that will generate Move code with minor changes (mutants) compared to the original one.
- Create a tool (`spec-verify`) to check if the mutants are valid according to the Move specifications and generate a report.
- Integrate those tools within the Aptos repository - new commands will be added to the `aptos` tool.

### Out of Scope

Two notable things are out of scope for this AIP:
- The Move Specification Testing tools will not help and point out the missing parts of the Move specifications. It will only check if the specifications are complete.
- The generated mutants cannot be used to check test suites, although extending the tools to support this feature is possible.

## Motivation

The developers write formal specifications in Move, which can be incomplete. The specifications are constraints, such as a predicate `x > 0`, which doesn't specify a particular value for x but merely constrains it. There is a need for a way of checking if those constraints are complete and restricted specification in the most proper way.

## Impact

As the proposed toolset verifies Move specifications, the target audience will be mainly the Move developers.

Smart contract developers will be able to perform additional action - contract specification verification, allowing them to improve the quality of their contracts before deploying them on the network.

## Alternative solutions

There is no standard solution for testing Move specifications. No other tool can also generate mutants from the source code for the Move programs.

Bytecode mutation can be an alternative solution for generating mutations for the Move smart contracts. However, such an approach can be less comfortable for the developers, as it produces mutations that must be decompiled to the source code to see the differences between them and the original code. Decompiling may introduce some noise (like omitting comments), making it harder to track the differences.

Similar tools for testing specifications are available for other languages, such as Solidity. There are at least two notable tools: Certora Gambit and SuMo-SOlidity-MUtator.

## Specification

The specification verification tool is placed inside the `aptos-core` repository, providing two additional `aptos` subcommands - `spec-verify` and `mutate`.

The `mutate` command is responsible for generating mutants from the Move source code. The Move mutator tool takes the source code as input and generates mutants by introducing small changes in the code. The changes are based on the mutation operators. Basically, the `mutate` command traverses the source files and applies mutation operators (making new mutants) to all possible places. Each mutant is saved in a separate file - one mutation per file. Before saving, the mutant can be checked by trying to compile it to avoid passing to the Move Prover invalid mutants.

1. Binary operator replacement - replaces binary operators with other binary operators. For example, the `+` operator can be replaced with the `-` operator. Operators are grouped into the following categories (operators are replaced within the same category. For example, the `+` operator can be replaced with the `-` operator but not the `<<` operator):
   - arithmetic operators: `+`, `-`, `*`, `/`, `%`
   - bitwise operators: `&`, `|`, `^`
   - shifts: `<<`, `>>`
   - comparison operators: `==`, `!=`, `<`, `>`, `<=`, `>=`
   - logical operators: `&&`, `||`
2. Unary operator replacement - this mutation operator replaces unary operators with other unary operators. For example, the `!` operator can be replaced with the space.
3. Type replacement - replaces types with other types. For example, the `u8` type can be replaced with the `u64` type.
4. Literal replacement - replaces literals with other literals. For example, the `0` literal can be replaced with the `1` literal or other random literal, `true` to `false`, etc. It's possible to choose the type of the literal to be replaced. For example, it's possible to replace only boolean literals.
5. Address replacement - replaces addresses with other addresses. For example, the `0x1`/`@std` address can be replaced with the `0x000A` address or another random address.
6. Return value replacement - replaces return values with other return values. For example, the concrete expressions can be replaced with concrete literals or other random literals.
7. Break/continue replacement or deletion - replaces or deletes break/continue statements with other break/continue statements.

The `spec-verify` command is responsible for running the Move mutator tool and then checking if the generated mutants are valid according to the Move specifications. It will do the following:
1. Take command line arguments both for the Move Prover tool and for the Move mutator tool. It can also read the configuration from the JSON configuration file.
2. Run the Move mutator tool (`mutate`) to generate mutants with the previously specified parameters.
3. Run the Move Prover tool, passing the generated mutants individually.
4. Collect the results and generate a report.

The report contains information about the generated mutants as well as the killed ones for each tested source file. All the intermediate results are saved in the configurable (default: `mutants_output`) directory.

## Reference Implementation

TBD

## Risks and Drawbacks

There are the following risks and drawbacks of this proposal:
- The set of mutation operators may be complete, as it is hard to predict all possible ways of introducing changes in the code. However, the tool is designed to be easily extendable, so it will be possible to add new operators in the future.
- Verifying the Move specifications can be time-consuming, as it requires running the Move compiler (check if the mutant is valid) and then Move Prover for each mutant. The more mutation operators are enabled and the longer the file is, the more time is required to verify the specifications. There are two ways to mitigate this issue:
 - The tool can be run in parallel, as each mutant is verified independently.
 - The tool's parameters can be adjusted to, e.g., run only a subset of mutation operators or downsample the number of mutants.

## Future Potential

Parts of this project, such as the Move Mutator tool, can be used to create mutants for other purposes. For example, it can be used to create a set of mutants and check if the test cases can detect them. So, there is a significant potential to become a test suite verification tool. The main difference would be calling tests instead of the Move Prover.

Thanks to the modular design, the tool can be easily extended to support more mutation operators and categories. It should influence the community to introduce new ways of generating mutants, and therefore, it can increase verification capabilities. That's the potential to produce better specifications and test suites.

## Timeline

### Suggested implementation timeline

The Move Specification Testing tools are expected to be implemented by the end of Q1 2024.

### Suggested developer platform support timeline

Instructions for the developers on how to use the tools and how to extend tools with new operators and categories will be provided by the end of Q1 2024, along with the project implementation.

### Suggested deployment timeline

The Move Specification Testing tools are a part of the Move language ecosystem and are used offline by the developers. Therefore, there is no need to deploy them on the networks.

## Security Considerations

This set of tools does not introduce any changes in the security model. Therefore, it does not have any security implications.
