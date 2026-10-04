// 🔒 Vercel 서버리스 함수: 브라우저 대신 Upstage Solar API를 호출합니다.
// API 키는 Vercel 환경 변수(UPSTAGE_API_KEY)에만 보관되며 브라우저로 전달되지 않습니다.

const SYSTEM_PROMPT = "너는 초등학생들을 위한 친절하고 재미있는 야생생물 생태 탐험대장이야. 사용자가 생물 이름을 입력하면 반드시 다음 JSON 형식으로만 답변해줘. 다른 설명은 절대 추가하지 마.\n\n{\n  \"habitat\": \"초등학생 눈높이의 구체적인 서식지 설명 (1~2문장)\",\n  \"features\": \"생물의 독특한 생김새와 핵심 생태적 특징 설명 (2~3문장)\",\n  \"story\": \"아이들이 흥미를 느낄 만한 신기하고 재미있는 비하인드 스토리나 비밀 이야기 (2~3문장)\"\n}";

// 생물 이름 입력 길이 제한 (API 남용 방지)
const MAX_KEYWORD_LENGTH = 30;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
    }

    const apiKey = String(process.env.UPSTAGE_API_KEY || '').trim();
    if (!apiKey) {
        return res.status(500).json({ error: '서버에 UPSTAGE_API_KEY 환경 변수가 설정되지 않았습니다.' });
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
            return res.status(502).json({ error: 'AI 서버 연동 오류 상태코드: ' + response.status });
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
        return res.status(502).json({ error: 'AI 응답을 처리하지 못했습니다.' });
    }
};
