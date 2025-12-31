import { openAIClient } from "../../constants/Config";
import { AstrologerRequest } from "../../types/astrologer/Request";

const aboutMePrompt = `As a third person, write a short and professional "About Me" paragraph for a personal or professional profile using the following details:
- Name: {{name}}
- Gender: {{gender}}
- Expertise: {{expertise}}
- Experience: {{experience}} years
- About Me (optional): {{aboutMe}}
- Languages Spoken: {{languages}}
Dont highlight the weaknesses, if they dont have any experience dont mention it. Dont't mention gender specifically, just use them for pronouns.
The paragraph should be concise (around 100–150 words), engaging, and reflect a professional tone. Highlight the person’s strengths, passion, and unique skills.`;

export const generateAstrologerAboutMe = async ({
	astrologerDetails,
}: {
	astrologerDetails: AstrologerRequest.AstrologerDetails & {name: string, gender: string};
}) => {
	const filledPrompt = aboutMePrompt
        .replace("{{gender}}", astrologerDetails.gender)
        .replace("{{name}}", astrologerDetails.name)
		.replace("{{expertise}}", astrologerDetails?.expertise?.join(", ") ?? "")
		.replace("{{experience}}", astrologerDetails?.experience?.toString() ?? "0")
		.replace("{{aboutMe}}", astrologerDetails.aboutMe ?? "")
		.replace("{{languages}}", astrologerDetails.languages?.join(", ") ?? ["English", "Hindi"].join(", "));

    console.log("the prompt is ", filledPrompt)

    const response = await openAIClient.responses.create({
        model: "gpt-3.5-turbo",
        input: filledPrompt
    })

    console.log("The about me is ", response.output_text)
    return await response.output_text
};
