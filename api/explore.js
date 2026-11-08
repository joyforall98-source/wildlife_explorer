// 🔒 Vercel 서버리스 함수: 브라우저 대신 Upstage Solar API를 호출합니다.
// API 키는 Vercel 환경 변수(UPSTAGE_API_KEY)에만 보관되며 브라우저로 전달되지 않습니다.

const SYSTEM_PROMPT = "너는 초등학생들을 위한 친절하고 재미있는 야생생물 생태 탐험대장이야. 사용자가 생물 이름을 입력하면 반드시 다음 JSON 형식으로만 답변해줘. 다른 설명은 절대 추가하지 마.\n\n{\n  \"habitat\": \"초등학생 눈높이의 구체적인 서식지 설명 (1~2문장)\",\n  \"features\": \"생물의 독특한 생김새와 핵심 생태적 특징 설명 (2~3문장)\",\n  \"story\": \"아이들이 흥미를 느낄 만한 신기하고 재미있는 비하인드 스토리나 비밀 이야기 (2~3문장)\"\n}";

// 생물 이름 입력 길이 제한 (API 남용 방지)
const MAX_KEYWORD_LENGTH = 30;

// 학생 화면에 보일 안내. 실제 원인(상태코드·Upstage 응답)은 Vercel 기록(Logs)에만 남깁니다
const RESTING = 'AI 도우미가 잠시 쉬고 있어요. 잠시 뒤에 다시 시도해보세요.';
const BUSY = '지금 질문이 많아 바로 답하기 어려워요. 잠시 뒤 다시 시도해 보세요.';

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
    }

    const apiKey = String(process.env.UPSTAGE_API_KEY || '').trim();
    if (!apiKey) {
        console.error('UPSTAGE_API_KEY 환경 변수가 없습니다');
        return res.status(500).json({ error: RESTING });
    }

    const keyword = String((req.body && req.body.keyword) || '').trim();
    if (!keyword) {
        return res.status(400).json({ error: '생물 이름을 입력해 주세요.' });
    }
    if (keyword.length > MAX_KEYWORD_LENGTH) {
        return res.status(400).json({ error: '생물 이름은 ' + MAX_KEYWORD_LENGTH + '자 이내로 입력해 주세요.' });
    }

    try {
        const response = await fetch('https://api.upstage.ai/v1/solar/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "solar-mini",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: '생물 이름: "' + keyword + '"\n반드시 이 생물에 대해서만 설명해줘.' }
                ],
                temperature: 0.7,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            // 401·403: 키 문제 또는 크레딧 소진, 429: 요청이 너무 많음
            console.error('Upstage 오류', response.status, (await response.text()).slice(0, 500));
            return res.status(502).json({ error: response.status === 429 ? BUSY : RESTING });
        }

        const responseData = await response.json();
        // 🌟 마크다운 역따옴표(```json) 정제 후 JSON 파싱
        const aiContent = responseData.choices[0].message.content
            .replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(aiContent);

        return res.status(200).json({
            habitat: String(data.habitat || ''),
            features: String(data.features || ''),
            story: String(data.story || '')
        });
    } catch (error) {
        console.error(error);
        return res.status(502).json({ error: '도감을 만들지 못했어요. 한 번 더 눌러 보세요.' });
    }
};
