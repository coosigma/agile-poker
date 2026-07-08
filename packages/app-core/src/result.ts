/**
 * Canonical error-as-value primitives for the domain / use-case layer.
 *
 * Following this codebase's conventions (Effect at boundaries, errors as
 * typed values), `Either` (success or typed error) and `Option` (present or
 * absent) come from Effect instead of a hand-rolled Result placeholder.
 */
export { Either, Option } from 'effect';
