"use client"

import { Authenticator } from "@aws-amplify/ui-react";

export default function AuthenticatorWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Authenticator formFields={{
        signUp: {
          preferred_username: {
            isRequired: true,
            order: 1,
          },
          email: {
            isRequired: true,
            order: 2,
          },
          password: {
            //label: 'パスワード',
            //placeholder: 'パスワードを入力',
            isRequired: true,
            order: 3,
          },
        },
      }}
      signUpAttributes={['email']}
 >{children}</Authenticator>;
}
