import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  IndexTable,
  EmptyState,
  Badge,
  Link,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const captures = await db.emailCapture.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  return { captures, shop: session.shop };
};

export default function Index() {
  const { captures } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Logo Finder" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card padding="0">
              {captures.length === 0 ? (
                <EmptyState
                  heading="No leads captured yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Add the <strong>Logo Finder</strong> block to a page from
                    the theme editor. Emails collected when shoppers unlock
                    their branded previews will show up here.
                  </p>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={{ singular: "lead", plural: "leads" }}
                  itemCount={captures.length}
                  headings={[
                    { title: "Email" },
                    { title: "Website" },
                    { title: "Logo" },
                    { title: "Captured" },
                  ]}
                  selectable={false}
                >
                  {captures.map((capture, index) => (
                    <IndexTable.Row
                      id={capture.id}
                      key={capture.id}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <Text as="span" fontWeight="semibold">
                          {capture.email}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Link url={capture.sourceUrl} target="_blank" removeUnderline>
                          {capture.sourceUrl}
                        </Link>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        {capture.logoUrl ? (
                          <Link url={capture.logoUrl} target="_blank" removeUnderline>
                            view
                          </Link>
                        ) : (
                          <Badge>none</Badge>
                        )}
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        {new Date(capture.createdAt).toLocaleString()}
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Total leads
                </Text>
                <Text as="p" variant="heading2xl">
                  {captures.length}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
