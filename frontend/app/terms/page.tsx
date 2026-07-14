import type { Metadata } from 'next';
import { LegalPage } from '../../components/LegalPage';

export const metadata: Metadata = {
  title: '이용약관 | PokéSim KR',
  description: 'PokéSim KR 서비스 이용 조건과 운영 기준입니다.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" updatedAt="2026년 7월 15일">
      <p>PokéSim KR을 이용할 때 필요한 내용만 정리했습니다.</p>

      <h2>1. 서비스 안내</h2>
      <p>
        PokéSim KR은 포켓몬 카드 개봉을 가볍게 체험하는 비영리·비공식 팬 프로젝트입니다.
        포켓몬코리아 및 권리자와 제휴하거나 공식 승인을 받은 서비스가 아니며, 상표와 카드
        이미지의 권리는 각 권리자에게 있습니다.
      </p>

      <h2>2. 확률과 시세</h2>
      <p>
        봉입률은 공개 자료를 바탕으로 한 추정·참고 정보입니다. 실제 제품의
        개봉 결과를 보장하지 않습니다.
      </p>

      <h2>3. 계정과 기록</h2>
      <p>
        시뮬레이션은 로그인 없이 이용할 수 있습니다. Google 로그인은 누적 운과 힛카드 도감을
        계정에 보관할 때만 사용하며, 마이페이지에서 언제든 계정을 삭제할 수 있습니다.
      </p>

      <h2>4. 이용 규칙</h2>
      <p>
        비정상적인 자동 요청, 보안 우회, 타인의 기록 접근, 서비스 사칭과 타인의 권리를
        침해하는 행위는 허용하지 않습니다.
      </p>

      <h2>5. 변경 및 문의</h2>
      <p>
        운영상 필요하거나 권리자의 요청이 있는 경우 기능이나 데이터가 변경·중단될 수 있습니다.
        운영자는 합리적인 범위에서 서비스를 안정적으로 제공하며, 관련 법령에서 정한 책임은
        따릅니다. 중요한 변경은 서비스에서 알리고, 문의는{' '}
        <a href="mailto:pokesimkr@gmail.com">pokesimkr@gmail.com</a>으로 받습니다.
      </p>
    </LegalPage>
  );
}
