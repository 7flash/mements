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
      fields?: JSX.HTMLAttributes<CustomElement>;
      name?: JSX.HTMLAttributes<CustomElement>;
      titles?: JSX.HTMLAttributes<CustomElement>;
      suggestions?: JSX.HTMLAttributes<CustomElement>;
      prompt?: JSX.HTMLAttributes<CustomElement>;      
    }
  }
}