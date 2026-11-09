// Apply the approved 1.3.1 label change (5cc4ab0) to historical fixtures.
// All conditions, amounts, and other labels remain part of the comparison.
export function withApprovedCalorieLabels(source) {
 return source.replaceAll('в пределах 2200 ккал', 'в пределах 2500 ккал');
}
