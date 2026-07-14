import type { Metadata } from 'next';
import { LegalPage } from '../../components/LegalPage';

export const metadata: Metadata = {
  title: '개인정보처리방침 | PokéSim KR',
  description: 'PokéSim KR의 개인정보 수집, 이용, 보관 및 삭제 기준입니다.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" updatedAt="2026년 7월 15일">
      <p>
        PokéSim KR은 Google 로그인과 기록 보관에 필요한 정보만 처리합니다. 로그인하지 않아도
        박스깡, 운 확인과 힛카드 도감을 이용할 수 있습니다.
      </p>

      <h2>1. 수집 정보와 이용 목적</h2>
      <ul>
        <li>
          <strong>Google 로그인:</strong> 계정 식별자, 이메일, 이름, 프로필 이미지와 닉네임을
          로그인·계정 표시에 사용합니다.
        </li>
        <li>
          <strong>기록 보관:</strong> 세트별 개봉 수와 사용 금액, 레어도별 획득 수, 힛카드
          번호·획득 횟수를 누적 운과 도감 복원에 사용합니다.
        </li>
        <li>
          <strong>서비스 이용 기록:</strong> 임의 방문자·세션 식별자, 이용한 세트와 모드,
          유입 경로 및 접속 정보를 이용 현황 파악과 보안에 사용합니다.
        </li>
      </ul>
      <p>
        Google 비밀번호는 전달받지 않습니다. 계정 기록에는 일반 카드 목록, 카드 이미지,
        카드 이름과 가격을 저장하지 않으며, 개인정보를 광고에 사용하거나 판매하지 않습니다.
      </p>

      <h2>2. 보관 및 삭제</h2>
      <ul>
        <li>Google 계정 정보와 계정 기록: 회원 탈퇴 시까지</li>
        <li>시뮬레이션 원본 이벤트: 14일</li>
        <li>페이지·기능 이용 원본 이벤트: 30일</li>
        <li>개인을 직접 식별하지 않는 일별 이용 집계: 서비스 운영 기간</li>
      </ul>
      <p>
        회원 탈퇴 시 계정과 서버 기록을 삭제합니다. 브라우저에만 저장된 기록은 기록 초기화나
        브라우저 데이터 삭제로 지울 수 있습니다. 법령상 보관 의무가 있는 경우에만 해당 기간
        동안 별도로 보관한 뒤 삭제합니다.
      </p>

      <h2>3. 외부 서비스</h2>
      <ul>
        <li><strong>Google LLC:</strong> Google 계정 인증과 계정 정보 제공</li>
        <li><strong>Supabase, Inc.:</strong> 인증과 계정 기록 보관(데이터베이스: 서울 리전)</li>
        <li><strong>Cloudflare, Inc.:</strong> 웹 서비스 제공, 접속 정보 처리와 보안</li>
      </ul>
      <p>
        외부 서비스 이용 과정에서 정보가 국외를 포함한 각 사업자의 운영 지역에서 처리될 수
        있으며, 서비스 제공에 필요한 기간 동안 각 사업자의 정책에 따라 보관될 수 있습니다.
        정보는 암호화된 연결로 전송되며, 법령상 요청이나 보안 대응 외에는 제3자에게 제공하지
        않습니다. Google 사용자 데이터에는{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        가 적용됩니다.
      </p>

      <h2>4. 이용자의 권리와 보호</h2>
      <p>
        이용자 또는 법정대리인은 마이페이지에서 계정 정보를 확인·수정하고 계정을 삭제할 수
        있습니다. 개인정보와 저장 기록의 열람·정정·삭제·처리정지는 아래 이메일로 요청할 수
        있습니다. PokéSim KR은 HTTPS와 계정별 접근 제한 등으로 정보를 보호합니다.
      </p>

      <h2>5. 문의</h2>
      <p>
        개인정보 보호 담당자는 PokéSim KR 운영자입니다. 문의와 권리 행사는{' '}
        <a href="mailto:pokesimkr@gmail.com">pokesimkr@gmail.com</a>으로 보내주세요. 방침이
        바뀌면 변경일을 갱신하고 중요한 내용은 서비스에서 알립니다.
      </p>
    </LegalPage>
  );
}
