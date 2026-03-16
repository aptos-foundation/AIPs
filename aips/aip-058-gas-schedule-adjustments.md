---
aip: 58
title: Gas Schedule Adjustments
author: igor-aptos (https://github.com/igor-aptos), vgao1996 (https://github.com/vgao1996)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Gas)
created: 11/19/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-58 - Gas Schedule Adjustments

There is a high discrepancy in current gas calibration. Adjust schedule based on high-level calibration (based on grouping into intrinsic, execution, io-read and io-write), while fully automated gas calibration is being developed.

## Summary

Current gas schedule doesn't correspond well with validator throughput. In perfect case, gas/s should be constant, for any workload.

We are going to take a set of representative workloads, run validator throughput benchmarks to measure their TPS, and then calibrate re-weighting 4 groups of charges to minimize square error against a target gas/s.
Four groups of charges we will look at here will be intrinsic, execution, io-read and io-write.

### Goals

Reduce discrepancy between largest and smallest gas/s throughput across different workloads.

### Out of Scope

- anything related to storage fees, as those are not for throughput, but for permanent storage charges.
- perfect gas calibration
- complete gas coverage


## Motivation

When gas/s throughput varies across workloads, block gas limit is ineffective as we either need to:
- set it too aggressively, and limiting throughput of workloads that have high gas/s
- set it too loosely, and have single block execution last too long for workloads that have low gas/s, in turn causing high latencies

## Impact

- concrete gas charges should change. Overall, we expect to reduce average gas prices, while some individual transactions might see an increase in gas cost (if they were undercharged today)

## Alternative solutions

- wait for full automated calibration (of all parameters independently). This leaves us longer with the issues of purely calibrated gas schedule.

## Specification

Based on current workloads, on a single core, on the given workloads we see a ratio of 23 between lowest and highest g/s. After calibration we see ratio droping to 3-4.

## Reference Implementation

* [https://github.com/aptos-labs/aptos-core/pull/11318](Python script to perform mass modifications of the gas schedule entries)
* [https://github.com/aptos-labs/aptos-core/pull/11237](Addition of new workloads, used for benchmarking)
* [https://github.com/aptos-labs/aptos-core/pull/11114](Tooling to do gas profiling on given workloads)
* [https://github.com/aptos-labs/aptos-core/pull/11215](Tool to optimize multipliers based on gas profiling and throughput)


## Testing (Optional)

Evaluating throughput and gas/s of various workloads, as well as looking at absolute price changes.

## Risks and Drawbacks

Risk is that we overfit - i.e. that for some specific workload, that we haven't included, recalibration produces significantly worse results.
We don't think this is likely, as we are calibrating only on few dimensions, while trying to have a representative set of workloads in the suite.

## Future Potential



## Timeline

deployment with 1.9

## Security Considerations

this AIP will only change gas constants, and the only effect it can have on security is potential “denial of service” with small amount of funds, if something is undercharged. (no values are set to 0, only multiplier is applied, so there is an upper bound on the issues). 
Overall, this resolves a few already present “undercharged” scenarios - it should only be beneficial in practice.
And gas market will continue to operate, limiting the effects of the issue as well.
