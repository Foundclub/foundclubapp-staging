/**
 * Lightweight web boundary for planning.
 * The native tutorial flow remains enabled on mobile via the default file.
 * @param {{ children: import('react').ReactNode }} props
 * @returns {import('react').ReactNode}
 */
function MyEventListTutorialBoundary({ children }) {
  return children;
}

export default MyEventListTutorialBoundary;
