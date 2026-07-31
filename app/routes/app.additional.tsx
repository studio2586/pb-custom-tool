import {
  Box,
  Card,
  Layout,
  List,
  Page,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function SetupPage() {
  return (
    <Page>
      <TitleBar title="Setup" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Add the block to your theme
              </Text>
              <List type="number">
                <List.Item>Go to Online Store &gt; Themes &gt; Customize.</List.Item>
                <List.Item>
                  Add a section, then choose <Code>Logo Finder</Code> under
                  Apps.
                </List.Item>
                <List.Item>
                  Customize the heading, subheading and colors from the
                  section settings, then save.
                </List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Placeholder product mockups
              </Text>
              <Text as="p" variant="bodyMd">
                The block currently overlays logos onto 5 placeholder
                mockups. Replace the files in{" "}
                <Code>public/mockups/</Code> with real product photography
                and update the matching logo placement zones in{" "}
                <Code>app/lib/mockups.ts</Code>.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <Box
      as="span"
      padding="025"
      paddingInlineStart="100"
      paddingInlineEnd="100"
      background="bg-surface-active"
      borderWidth="025"
      borderColor="border"
      borderRadius="100"
    >
      <code>{children}</code>
    </Box>
  );
}
