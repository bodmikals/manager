import { Disk } from '@linode/api-v4/lib/linodes';
import { APIError } from '@linode/api-v4/lib/types';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import * as React from 'react';
import { compose } from 'recompose';
import ActionsPanel from 'src/components/ActionsPanel';
import AddNewLink from 'src/components/AddNewLink';
import Button from 'src/components/Button';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog/ConfirmationDialog';
import Hidden from 'src/components/core/Hidden';
import { createStyles, withStyles, WithStyles } from '@mui/styles';
import { Theme } from '@mui/material/styles';
import { TableBody } from 'src/components/TableBody';
import { TableHead } from 'src/components/TableHead';
import Typography from 'src/components/core/Typography';
import Grid from '@mui/material/Unstable_Grid2';
import { TooltipIcon } from 'src/components/TooltipIcon/TooltipIcon';
import { Notice } from 'src/components/Notice/Notice';
import OrderBy from 'src/components/OrderBy';
import Paginate from 'src/components/Paginate';
import { PaginationFooter } from 'src/components/PaginationFooter/PaginationFooter';
import { Table } from 'src/components/Table';
import { TableCell } from 'src/components/TableCell';
import { TableRow } from 'src/components/TableRow';
import { TableRowEmpty } from 'src/components/TableRowEmpty/TableRowEmpty';
import { TableRowError } from 'src/components/TableRowError/TableRowError';
import { TableSortCell } from 'src/components/TableSortCell';
import { resetEventsPolling } from 'src/eventsPolling';
import ImagesDrawer, { DrawerMode } from 'src/features/Images/ImagesDrawer';
import {
  CreateLinodeDisk,
  DeleteLinodeDisk,
  ResizeLinodeDisk,
  UpdateLinodeDisk,
  withLinodeDetailContext,
} from 'src/features/Linodes/LinodesDetail/linodeDetailContext';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import { sendLinodeDiskEvent } from 'src/utilities/analytics';
import LinodeDiskDrawer from './LinodeDiskDrawer';
import LinodeDiskRow from './LinodeDiskRow';

type ClassNames =
  | 'root'
  | 'headline'
  | 'addNewWrapper'
  | 'addNewWrapperContainer'
  | 'emptyCell';

const styles = (theme: Theme) =>
  createStyles({
    root: {
      backgroundColor: theme.color.white,
      margin: 0,
      width: '100%',
    },
    headline: {
      marginTop: 8,
      marginBottom: 8,
      marginLeft: 15,
      lineHeight: '1.5rem',
    },
    addNewWrapperContainer: {
      display: 'flex',
      flexDirection: 'row',
    },
    addNewWrapper: {
      [theme.breakpoints.down('sm')]: {
        marginLeft: `-${theme.spacing(1.5)}`,
      },
      '&.MuiGrid-item': {
        padding: 5,
      },
    },
  });

interface ConfirmDeleteState {
  open: boolean;
  submitting: boolean;
  errors?: APIError[];
  id?: number;
  label?: string;
}

interface DrawerState {
  open: boolean;
  mode: 'create' | 'rename' | 'resize';
  diskId?: number;
  maximumSize: number;
}

interface ImagizeDrawerState {
  open: boolean;
  description?: string;
  label?: string;
  disk?: Disk;
}

interface State {
  drawer: DrawerState;
  imagizeDrawer: ImagizeDrawerState;
  confirmDelete: ConfirmDeleteState;
  authorized_users: string[];
}

interface Props {
  errors?: APIError[];
}

type CombinedProps = Props &
  LinodeContextProps &
  WithStyles<ClassNames> &
  WithSnackbarProps;

const defaultDrawerState: DrawerState = {
  open: false,
  mode: 'create',
  maximumSize: 0,
};

const defaultImagizeDrawerState: ImagizeDrawerState = {
  open: false,
  description: '',
  label: '',
  disk: undefined,
};

const defaultConfirmDeleteState: ConfirmDeleteState = {
  open: false,
  id: undefined,
  label: undefined,
  submitting: false,
};

class LinodeDisks extends React.Component<CombinedProps, State> {
  private disksHeader: React.RefObject<any>;
  constructor(props: CombinedProps) {
    super(props);

    this.disksHeader = React.createRef();

    this.state = {
      drawer: defaultDrawerState,
      imagizeDrawer: defaultImagizeDrawerState,
      confirmDelete: defaultConfirmDeleteState,
      authorized_users: [],
    };
  }

  render() {
    const {
      classes,
      disks,
      linodeStatus,
      linodeTotalDisk,
      readOnly,
    } = this.props;

    const usedDiskSpace = addUsedDiskSpace(disks);

    const freeDiskSpace = linodeTotalDisk && linodeTotalDisk > usedDiskSpace;
    const noFreeDiskSpaceWarning =
      'You do not have enough unallocated storage to create a Disk. Please choose a different plan with more storage or delete an existing Disk.';

    return (
      <React.Fragment>
        <Grid
          className={classes.root}
          container
          alignItems="flex-end"
          justifyContent="space-between"
          spacing={1}
        >
          <Grid ref={this.disksHeader} className="p0">
            <Typography variant="h3" className={classes.headline}>
              Disks
            </Typography>
          </Grid>
          <span className={classes.addNewWrapperContainer}>
            {!freeDiskSpace ? (
              <TooltipIcon
                text={noFreeDiskSpaceWarning}
                status="help"
                tooltipAnalyticsEvent={() =>
                  sendLinodeDiskEvent(
                    'Resize',
                    'Open:tooltip',
                    'Add a Disk help icon tooltip'
                  )
                }
              />
            ) : undefined}
            <Grid className={classes.addNewWrapper}>
              <AddNewLink
                onClick={this.openDrawerForCreation}
                label="Add a Disk"
                disabled={readOnly || !freeDiskSpace}
              />
            </Grid>
          </span>
        </Grid>
        <OrderBy
          data={disks}
          orderBy={'created'}
          order={'asc'}
          preferenceKey="linode-disks"
        >
          {({ data: orderedData, handleOrderChange, order, orderBy }) => (
            <Paginate data={orderedData} scrollToRef={this.disksHeader}>
              {({
                data: paginatedData,
                handlePageChange,
                handlePageSizeChange,
                page,
                pageSize,
                count,
              }) => {
                return (
                  <React.Fragment>
                    <Grid xs={12}>
                      <Table aria-label="List of Disks">
                        <TableHead>
                          <TableRow>
                            <TableSortCell
                              active={orderBy === 'label'}
                              label="label"
                              direction={order}
                              handleClick={handleOrderChange}
                            >
                              Label
                            </TableSortCell>
                            <TableSortCell
                              active={orderBy === 'filesystem'}
                              label="filesystem"
                              direction={order}
                              handleClick={handleOrderChange}
                            >
                              Type
                            </TableSortCell>
                            <TableSortCell
                              active={orderBy === 'size'}
                              label="size"
                              direction={order}
                              handleClick={handleOrderChange}
                            >
                              Size
                            </TableSortCell>
                            <Hidden mdDown>
                              <TableSortCell
                                active={orderBy === 'created'}
                                label="created"
                                direction={order}
                                handleClick={handleOrderChange}
                              >
                                Created
                              </TableSortCell>
                            </Hidden>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {this.renderTableContent(paginatedData, linodeStatus)}
                        </TableBody>
                      </Table>
                    </Grid>
                    <PaginationFooter
                      page={page}
                      pageSize={pageSize}
                      count={count}
                      handlePageChange={handlePageChange}
                      handleSizeChange={handlePageSizeChange}
                      eventCategory="linode disks"
                    />
                  </React.Fragment>
                );
              }}
            </Paginate>
          )}
        </OrderBy>
        <this.confirmationDialog />
        <this.drawer />
        <this.imagizeDrawer />
      </React.Fragment>
    );
  }

  renderTableContent = (disks: Disk[], status?: string) => {
    const { errors, linodeId, readOnly } = this.props;

    if (errors) {
      return (
        <TableRowError
          colSpan={4}
          message="There was an error loading disk images."
        />
      );
    }

    if (disks.length === 0) {
      return <TableRowEmpty colSpan={5} />;
    }

    return disks.map((disk) => (
      <LinodeDiskRow
        key={disk.id}
        disk={disk}
        linodeId={linodeId}
        linodeStatus={status || 'offline'}
        onRename={this.openDrawerForRename(disk.id)}
        onResize={this.openDrawerForResize(disk)}
        onImagize={this.openImagizeDrawer(disk)}
        onDelete={this.openConfirmDelete(disk)}
        readOnly={readOnly}
      />
    ));
  };

  /**
   * Disk Deletion Confirmation
   */
  setConfirmDelete = (
    obj: Partial<ConfirmDeleteState>,
    fn: () => void = () => null
  ) => {
    const { confirmDelete } = this.state;
    this.setState({ confirmDelete: { ...confirmDelete, ...obj } }, () => {
      fn();
    });
  };

  confirmationDialog = () => {
    const { open, label, errors } = this.state.confirmDelete;

    return (
      <ConfirmationDialog
        onClose={this.closeConfirmDelete}
        title="Confirm Delete"
        open={open}
        actions={this.confirmDeleteActions}
      >
        {errors && <Notice error text={errors[0].reason} />}
        <Typography>Are you sure you want to delete {label}?</Typography>
      </ConfirmationDialog>
    );
  };

  confirmDeleteActions = () => {
    const { submitting } = this.state.confirmDelete;
    return (
      <ActionsPanel style={{ padding: 0 }}>
        <Button
          buttonType="secondary"
          onClick={this.closeConfirmDelete}
          data-qa-cancel-delete
        >
          Cancel
        </Button>
        <Button
          buttonType="primary"
          onClick={this.deleteDisk}
          loading={submitting}
          data-qa-confirm-delete
        >
          Delete
        </Button>
      </ActionsPanel>
    );
  };

  openConfirmDelete = (disk: Disk) => () => {
    this.setConfirmDelete({
      open: true,
      submitting: false,
      errors: undefined,
      id: disk.id,
      label: disk.label,
    });
  };

  closeConfirmDelete = () => {
    this.setConfirmDelete({ open: false });
  };

  /**
   * Updates imagize drawer state
   */
  setImagizeDrawer = (
    obj: Partial<ImagizeDrawerState>,
    fn: () => void = () => null
  ) => {
    this.setState(
      { imagizeDrawer: { ...this.state.imagizeDrawer, ...obj } },
      () => {
        fn();
      }
    );
  };

  imagizeDrawer = () => {
    const { open, description, label, disk } = this.state.imagizeDrawer;
    return (
      <ImagesDrawer
        mode={'imagize' as DrawerMode}
        open={open}
        description={description}
        label={label}
        disks={disk ? [disk] : []}
        selectedDisk={disk ? '' + disk.id : null}
        onClose={this.closeImagizeDrawer}
        changeDescription={this.changeImageDescription}
        changeLabel={this.changeImageLabel}
        changeDisk={() => null}
        changeLinode={() => null}
        selectedLinode={null}
      />
    );
  };

  openImagizeDrawer = (disk: Disk) => () => {
    this.setImagizeDrawer({
      ...defaultImagizeDrawerState,
      open: true,
      disk,
    });
  };

  closeImagizeDrawer = () => {
    this.setImagizeDrawer({ open: false });
  };

  changeImageDescription = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setImagizeDrawer({
      description: e.target.value,
    });
  };

  changeImageLabel = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setImagizeDrawer({
      label: e.target.value,
    });
  };

  /**
   * Create/Rename/Resize Drawer
   */
  setDrawer = (obj: Partial<DrawerState>, fn: () => void = () => null) => {
    this.setState({ drawer: { ...this.state.drawer, ...obj } }, () => {
      fn();
    });
  };

  setAuthorizedUsers = (value: string[]) => {
    this.setState({ authorized_users: value });
  };

  drawer = () => {
    const { diskId, mode, open, maximumSize } = this.state.drawer;
    const { disks } = this.props;

    return (
      <LinodeDiskDrawer
        mode={mode}
        open={open}
        disk={disks.find((thisDisk) => thisDisk.id === diskId)}
        maximumSize={maximumSize}
        onClose={this.closeDrawer}
        onSubmit={this.onDrawerSubmit}
        setAuthorizedUsers={this.setAuthorizedUsers}
        authorizedUsers={this.state.authorized_users}
      />
    );
  };

  onDrawerSubmit = (values: any): Promise<any> => {
    switch (this.state.drawer.mode) {
      case 'create':
        return this.createDisk(values);
      case 'rename':
        return this.renameDisk(values.label);
      case 'resize':
        return this.resizeDisk(values.size);
    }
  };

  resizeDisk = (size: number) => {
    const { linodeId, resizeLinodeDisk } = this.props;
    const { diskId } = this.state.drawer;
    if (!linodeId || !diskId) {
      // Safety check; should never happen.
      return Promise.reject({ reason: 'Invalid disk or Linode' });
    }

    return resizeLinodeDisk(diskId, size).then((_) => {
      this.props.enqueueSnackbar(`Disk queued for resizing.`, {
        variant: 'info',
      });
      resetEventsPolling();
    });
  };

  createDisk = (values: any) => {
    const { linodeId, createLinodeDisk } = this.props;
    const { label, size, filesystem, image, root_pass } = values;
    if (!linodeId) {
      // Safety check; should never happen.
      return Promise.reject({ reason: 'Invalid Linode' });
    }

    return createLinodeDisk({
      label,
      size,
      filesystem: filesystem === '_none_' ? undefined : filesystem,
      image: Boolean(image) ? image : undefined,
      root_pass: Boolean(root_pass) ? root_pass : undefined,
      authorized_users: this.state.authorized_users,
    }).then((_) => resetEventsPolling());
  };

  renameDisk = (label: string) => {
    const { linodeId, updateLinodeDisk } = this.props;
    const { diskId } = this.state.drawer;
    if (!linodeId || !diskId) {
      // Safety check; should never happen.
      return Promise.reject({ reason: 'Invalid disk or Linode' });
    }
    return updateLinodeDisk(diskId, { label });
  };

  deleteDisk = () => {
    this.setConfirmDelete({ submitting: true, errors: undefined });

    const { linodeId, deleteLinodeDisk } = this.props;
    const { id: diskId } = this.state.confirmDelete;
    if (!linodeId || !diskId) {
      return;
    }

    deleteLinodeDisk(diskId)
      .then(() => {
        this.setConfirmDelete({ open: false, errors: undefined });
      })
      .catch((error) => {
        // This error only fires if the request fails;
        // if the deletion hostjob fails, it must be handled through events/Redux.
        const errors = getAPIErrorOrDefault(
          error,
          'There was an error deleting your disk.'
        );
        this.setConfirmDelete({ errors, submitting: false });
      });
  };

  openDrawerForRename = (diskId: number) => () => {
    this.setDrawer({
      diskId,
      mode: 'rename',
      open: true,
    });
  };

  openDrawerForResize = ({ id: diskId, size }: Disk) => () => {
    this.setDrawer({
      diskId,
      maximumSize: Math.max(size, this.calculateDiskFree(diskId)),
      mode: 'resize',
      open: true,
    });
  };

  openDrawerForCreation = () => {
    const maximumSize = this.calculateDiskFree(0);

    this.setDrawer({
      diskId: undefined,
      maximumSize,
      mode: 'create',
      open: true,
    });
  };

  closeDrawer = () => {
    this.setDrawer({ open: false });
  };

  calculateDiskFree = (diskId: number): number => {
    /**
     * So if there's more than 100 disks, then this count will be off.
     */
    const { linodeTotalDisk, disks } = this.props;
    if (!linodeTotalDisk || !disks) {
      return 0;
    }
    return (
      linodeTotalDisk -
      disks.reduce((acc: number, disk: Disk) => {
        return diskId === disk.id ? acc : acc + disk.size;
      }, 0)
    );
  };
}

const styled = withStyles(styles);

export const addUsedDiskSpace = (disks: Disk[]) => {
  return disks.reduce((accum, eachDisk) => eachDisk.size + accum, 0);
};

interface LinodeContextProps {
  linodeId?: number;
  linodeStatus?: string;
  linodeTotalDisk?: number;
  deleteLinodeDisk: DeleteLinodeDisk;
  updateLinodeDisk: UpdateLinodeDisk;
  createLinodeDisk: CreateLinodeDisk;
  resizeLinodeDisk: ResizeLinodeDisk;
  readOnly: boolean;
  disks: Disk[];
}

const linodeContext = withLinodeDetailContext(
  ({
    linode,
    deleteLinodeDisk,
    updateLinodeDisk,
    createLinodeDisk,
    resizeLinodeDisk,
  }) => ({
    linodeId: linode.id,
    linodeTotalDisk: linode.specs.disk,
    linodeStatus: linode.status,
    deleteLinodeDisk,
    updateLinodeDisk,
    createLinodeDisk,
    resizeLinodeDisk,
    readOnly: linode._permissions === 'read_only',
    disks: linode._disks,
  })
);

const enhanced = compose<CombinedProps, {}>(
  styled,
  linodeContext,
  withSnackbar
);

export default enhanced(LinodeDisks);