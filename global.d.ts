/*
expand to support following

            <>
              <output content="fields" />
              <settings temperature={0.5} model="gpt-4o" />
              <system>
                <instruction>
                  Generate fields for an agent entry based on the provided idea.
                </instruction>
                <responseFormat>
                  <thinking>THINK carefully before responding.</thinking>
                  <fields>
                    <name>Name of the bot</name>
                    <titles>List of alternative titles for the bot</titles>
                    <suggestions>List of items to scroll</suggestions>
                    <prompt>System prompt for the bot</prompt>
                  </fields>
                </responseFormat>
                <example>
                  <name>AI Guide</name>
                  <titles>["Guide", "Counselor"]</titles>
                  <suggestions>["Incorporate practices", "Balance modern life"]</suggestions>
                  <prompt>You are an AI expert. Provide guidance and advice.</prompt>
                </example>
              </system>
              <user>
                {data.idea}
              </user>
            </>,

*/

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      output?: JSX.HTMLAttributes<CustomElement>;
      settings?: JSX.HTMLAttributes<CustomElement> & {
        temperature?: number;
        model?: string;
      };
      system?: JSX.HTMLAttributes<CustomElement>;
      instruction?: JSX.HTMLAttributes<CustomElement>;
      responseFormat?: JSX.HTMLAttributes<CustomElement>;
      thinking?: JSX.HTMLAttributes<CustomElement>;
      response?: JSX.HTMLAttributes<CustomElement>;
      content?: JSX.HTMLAttributes<CustomElement>;
      example?: JSX.HTMLAttributes<CustomElement>;
      user?: JSX.HTMLAttributes<CustomElement>;
      context?: JSX.HTMLAttributes<CustomElement>;
      question?: JSX.HTMLAttributes<CustomElement>;
    }
  }
}