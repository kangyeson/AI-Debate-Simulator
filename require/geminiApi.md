Gemini API 빠른 시작

content_copy


이 빠른 시작에서는 라이브러리를 설치하고 첫 번째 Gemini API 요청을 만드는 방법을 보여줍니다.

시작하기 전에
Gemini API 키가 필요합니다. 아직 키가 없다면 Google AI Studio에서 무료로 키를 받으세요.

Google GenAI SDK 설치
Python
자바스크립트
Go
자바
Apps Script
새 Apps Script 프로젝트를 만들려면 script.new로 이동하세요.
제목 없는 프로젝트를 클릭합니다.
Apps Script 프로젝트의 이름을 AI Studio로 바꾸고 이름 바꾸기를 클릭합니다.
API 키를 설정합니다.
왼쪽에서 프로젝트 설정 프로젝트 설정 아이콘을 클릭합니다.
스크립트 속성에서 스크립트 속성 추가를 클릭합니다.
속성에 키 이름 GEMINI_API_KEY를 입력합니다.
값에 API 키 값을 입력합니다.
스크립트 속성 저장을 클릭합니다.
Code.gs 파일 콘텐츠를 다음 코드로 바꿉니다.
첫 번째 요청하기
다음은 generateContent 메서드를 사용하여 Gemini 2.5 Flash 모델을 통해 Gemini API에 요청을 전송하는 예입니다.

API 키를 환경 변수 GEMINI_API_KEY로 설정하면 Gemini API 라이브러리를 사용할 때 클라이언트에서 자동으로 선택합니다. 그렇지 않으면 클라이언트를 초기화할 때 API 키를 인수로 전달해야 합니다.

Gemini API 문서의 모든 코드 샘플은 환경 변수 GEMINI_API_KEY를 설정했다고 가정합니다.

Python
자바스크립트
Go
자바
Apps Script
REST

// See https://developers.google.com/apps-script/guides/properties
// for instructions on how to set the API key.
const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
function main() {
  const payload = {
    contents: [
      {
        parts: [
          { text: 'Explain how AI works in a few words' },
        ],
      },
    ],
  };

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': apiKey,
    },
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response);
  const content = data['candidates'][0]['content']['parts'][0]['text'];
  console.log(content);
}
다음 단계
첫 번째 API 요청을 완료했으므로 Gemini의 작동 방식을 보여주는 다음 가이드를 살펴보세요.

텍스트 생성

content_copy


Gemini API는 Gemini 모델을 활용하여 텍스트, 이미지, 동영상, 오디오 등 다양한 입력에서 텍스트 출력을 생성할 수 있습니다.

다음은 단일 텍스트 입력을 사용하는 기본 예입니다.

Python
자바스크립트
Go
자바
REST
Apps Script

// See https://developers.google.com/apps-script/guides/properties
// for instructions on how to set the API key.
const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

function main() {
  const payload = {
    contents: [
      {
        parts: [
          { text: 'How AI does work?' },
        ],
      },
    ],
  };

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': apiKey,
    },
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response);
  const content = data['candidates'][0]['content']['parts'][0]['text'];
  console.log(content);
}