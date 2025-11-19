---
title: How to Submit an AIP
description: Guide for submitting Aptos Improvement Proposals
---

## Submission Process

To submit an AIP, follow these steps:

### 1. Fork the Repository

Fork the [AIPs repository](https://github.com/aptos-foundation/AIPs) into your own GitHub account.

### 2. Create Your AIP File

Copy the [`TEMPLATE.md`](https://github.com/aptos-foundation/AIPs/blob/main/TEMPLATE.md) file into a new AIP file in the `aips/` directory:

```bash
cp TEMPLATE.md aips/your-feature-name.md
```

**Important naming conventions:**
- ✅ Good: `aips/new-zero-knowledge-range-proof-verifiers.md`
- ❌ Bad: `aips/aip-14.md` or `aips/14.md`

Name your AIP file based on your feature, **not** the AIP number, which will be assigned later by the AIP manager.

### 3. Edit Your AIP

Fill in the template with your proposal details:

- **YAML Header**: Complete all required metadata fields
- **Summary**: Provide a 3-5 sentence overview
- **High-level Overview**: Describe your solution approach
- **Specification**: Detail the technical implementation
- **Impact**: Identify affected audiences
- **Alternative Solutions**: Explain why this approach is best
- **Risks and Drawbacks**: Address potential concerns
- **Testing**: Outline your testing strategy
- **Timeline**: Provide implementation estimates

Follow the template guidelines to the best of your ability.

### 4. Commit and Push

Commit your changes to your forked repository:

```bash
git add aips/your-feature-name.md
git commit -m "Add AIP: Your Feature Name"
git push origin main
```

### 5. Submit a Pull Request

Create a pull request from your fork to the main AIPs repository.

### 6. Create a Discussion Issue

To start discussing your AIP with the community, create a GitHub Issue for your AIP using the default Issue template. This allows for community feedback and discussion.

## AIP Review Process

Once submitted, your AIP will go through the following stages:

1. **Draft**: Your AIP is being worked on and refined
2. **In Review**: Community members review and provide feedback
3. **Ready for Approval**: AIP is ready for Gatekeeper approval
4. **Accepted**: AIP has been accepted and will be implemented
5. **Rejected** or **On Hold**: Community decision or missing information

## Requirements for AIPs

Your AIP should:

- Solve a clear problem in the Aptos ecosystem
- Be technically feasible
- Consider backward compatibility
- Address security implications
- Include adequate testing plans
- Define success metrics

## Getting Help

- Review existing AIPs for examples
- Ask questions in GitHub Issues
- Join the Aptos community Discord
- Consult the [README](https://github.com/aptos-foundation/AIPs/blob/main/README.md) for detailed guidelines

## Governance Voting

To vote on AIPs that impact the state of the blockchain, visit the [Aptos Governance Portal](https://governance.aptosfoundation.org/).
