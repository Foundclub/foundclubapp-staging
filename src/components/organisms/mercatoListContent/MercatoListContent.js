import RecruitmentProfilesList from '@/components/organisms/recruitmentProfilesList/RecruitmentProfilesList';

/**
 * Legacy wrapper kept to avoid diverging profile search implementations.
 * @returns {import('react').ReactElement}
 */
function MercatoListContent() {
  return <RecruitmentProfilesList bottomPadding={40} />;
}

export default MercatoListContent;
